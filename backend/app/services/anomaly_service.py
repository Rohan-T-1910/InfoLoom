import os
import uuid
from typing import Any, Optional
import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.anomaly import AnomalyModel
from app.repositories.anomaly_repository import anomaly_repository
from app.repositories.dataset_repository import dataset_repository
from app.schemas.anomaly import (
    AnomalyDistributionBucket,
    AnomalyEvaluationRequest,
    AnomalyEvaluationResponse,
    AnomalyFeatureInfo,
    AnomalyFeaturesResponse,
    AnomalyRunRequest,
    AnomalyScatterPoint,
    AnomalousRowDetail,
    FeatureDeviation,
)
from app.services.validation_service import validation_service


class AnomalyDetectionService:
    """Service providing unsupervised anomaly detection using Isolation Forest,
    threshold tuning, feature-level deviation explanation, and multi-tenant persistence.
    """

    def get_numeric_features(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        use_cleaned: bool = True,
    ) -> AnomalyFeaturesResponse:
        """Inspects dataset and returns numeric features suitable for Isolation Forest anomaly detection."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        file_path = (
            dataset.cleaned_file_path
            if (use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
            else dataset.file_path
        )
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)
        numeric_features: list[AnomalyFeatureInfo] = []
        recommended_features: list[str] = []

        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                series = df[col].dropna()
                non_null_count = int(series.count())
                missing_count = int(df[col].isna().sum())

                mean_val = float(series.mean()) if non_null_count > 0 else None
                std_val = float(series.std()) if non_null_count > 1 else None
                min_val = float(series.min()) if non_null_count > 0 else None
                max_val = float(series.max()) if non_null_count > 0 else None

                info = AnomalyFeatureInfo(
                    name=str(col),
                    data_type=str(df[col].dtype),
                    non_null_count=non_null_count,
                    missing_count=missing_count,
                    min=round(min_val, 4) if min_val is not None else None,
                    max=round(max_val, 4) if max_val is not None else None,
                    mean=round(mean_val, 4) if mean_val is not None else None,
                    std=round(std_val, 4) if std_val is not None else None,
                )
                numeric_features.append(info)

                # Recommend numeric features with variance (>1 unique value, std > 0)
                if non_null_count >= 10 and series.nunique() > 1 and (std_val is not None and std_val > 1e-6):
                    recommended_features.append(str(col))

        return AnomalyFeaturesResponse(
            dataset_id=dataset_id,
            is_cleaned=bool(use_cleaned and dataset.has_cleaned),
            total_rows=len(df),
            numeric_features=numeric_features,
            recommended_features=recommended_features,
        )

    def _prepare_and_validate(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        features: list[str],
        contamination: Optional[float],
        use_cleaned: bool,
    ) -> tuple[pd.DataFrame, list[str], np.ndarray, np.ndarray]:
        """Validates ownership, column presence, numeric types, sample size,
        and returns the raw dataframe, validated features, imputed array, and scaled array.
        """
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        if not features or len(features) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one numeric feature must be selected for anomaly detection.",
            )

        if contamination is not None and (contamination <= 0.0 or contamination > 0.5):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Contamination rate must be between 0.001 and 0.50 (0.1% to 50%).",
            )

        file_path = (
            dataset.cleaned_file_path
            if (use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
            else dataset.file_path
        )
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)

        # Validate feature existence and numeric types
        validated_features: list[str] = []
        for feat in features:
            if feat not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Selected feature '{feat}' does not exist in dataset.",
                )
            if not pd.api.types.is_numeric_dtype(df[feat]):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Feature '{feat}' is not numeric. Anomaly detection requires numeric columns.",
                )
            validated_features.append(feat)

        n_samples = len(df)
        if n_samples < 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Dataset has only {n_samples} rows. Anomaly detection requires at least 10 observations.",
            )

        # Impute missing values with median
        imputer = SimpleImputer(strategy="median")
        X_imputed = imputer.fit_transform(df[validated_features])

        # Standard scale for parity in isolation partition and z-score calculation
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_imputed)

        return df, validated_features, X_imputed, X_scaled

    def _compute_distribution_buckets(
        self, raw_scores: np.ndarray, is_anomaly: np.ndarray, n_bins: int = 10
    ) -> list[AnomalyDistributionBucket]:
        """Calculates score histogram buckets separating normal vs anomalous counts."""
        s_min = float(np.min(raw_scores))
        s_max = float(np.max(raw_scores))
        if s_max == s_min:
            s_max += 1e-4

        bins = np.linspace(s_min, s_max, n_bins + 1)
        buckets: list[AnomalyDistributionBucket] = []

        for b in range(n_bins):
            b_low = bins[b]
            b_high = bins[b + 1]
            if b == n_bins - 1:
                mask = (raw_scores >= b_low) & (raw_scores <= b_high)
            else:
                mask = (raw_scores >= b_low) & (raw_scores < b_high)

            total_count = int(np.sum(mask))
            anom_count = int(np.sum(mask & is_anomaly))
            label = f"{b_low:.3f} to {b_high:.3f}"

            buckets.append(
                AnomalyDistributionBucket(
                    bucket_min=round(float(b_low), 4),
                    bucket_max=round(float(b_high), 4),
                    label=label,
                    count=total_count,
                    anomaly_count=anom_count,
                )
            )

        return buckets

    def evaluate_anomaly_config(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        request: AnomalyEvaluationRequest,
    ) -> AnomalyEvaluationResponse:
        """Evaluates Isolation Forest with proposed configuration and generates score distribution."""
        df, validated_features, _, X_scaled = self._prepare_and_validate(
            db, dataset_id, user_id, request.features, request.contamination, request.use_cleaned
        )

        contamination_val = float(request.contamination) if request.contamination is not None else 0.05
        model = IsolationForest(
            n_estimators=50,
            contamination=contamination_val,
            random_state=42,
        )
        model.fit(X_scaled)

        raw_scores = model.decision_function(X_scaled)
        preds = model.predict(X_scaled)
        is_anomaly = preds == -1

        n_samples = len(df)
        n_anomalies = int(np.sum(is_anomaly))
        anomaly_pct = round((n_anomalies / n_samples) * 100, 2)

        threshold = float(model.offset_)
        s_min = round(float(np.min(raw_scores)), 4)
        s_max = round(float(np.max(raw_scores)), 4)
        s_mean = round(float(np.mean(raw_scores)), 4)

        distribution_buckets = self._compute_distribution_buckets(raw_scores, is_anomaly)

        return AnomalyEvaluationResponse(
            features=validated_features,
            n_samples=n_samples,
            estimated_anomalies=n_anomalies,
            estimated_percentage=anomaly_pct,
            threshold_score=round(threshold, 4),
            score_min=s_min,
            score_max=s_max,
            score_mean=s_mean,
            suggested_contamination=contamination_val,
            score_distribution=distribution_buckets,
        )

    def run_anomaly_detection(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        request: AnomalyRunRequest,
    ) -> AnomalyModel:
        """Trains Isolation Forest on selected numeric features, extracts anomaly scores,
        calculates feature explanations via inlier z-scores, projects 2D scatter coordinates,
        persists model pipeline artifacts, and saves records to database.
        """
        df, validated_features, X_imputed, X_scaled = self._prepare_and_validate(
            db, dataset_id, user_id, request.features, request.contamination, request.use_cleaned
        )

        contamination_val = float(request.contamination) if request.contamination is not None else 0.05
        n_estimators = int(request.n_estimators) if request.n_estimators is not None else 100

        model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination_val,
            random_state=42,
        )
        model.fit(X_scaled)

        raw_scores = model.decision_function(X_scaled)
        preds = model.predict(X_scaled)
        is_anomaly = preds == -1

        n_samples = len(df)
        n_anomalies = int(np.sum(is_anomaly))
        anomaly_pct = round((n_anomalies / n_samples) * 100, 2)

        s_min = float(np.min(raw_scores))
        s_max = float(np.max(raw_scores))
        s_mean = float(np.mean(raw_scores))
        threshold_val = float(model.offset_)

        # Normalized anomaly score in [0, 1] range where 1 is most anomalous
        score_range = (s_max - s_min) if (s_max - s_min) > 1e-8 else 1.0
        normalized_scores = (s_max - raw_scores) / score_range

        # Compute inlier statistics for feature explanation
        inlier_mask = preds == 1
        if np.sum(inlier_mask) < 2:
            # Fallback to entire dataset if almost everything is flagged
            inlier_mask = np.ones(n_samples, dtype=bool)

        inlier_means = {
            feat: float(np.mean(X_imputed[inlier_mask, idx]))
            for idx, feat in enumerate(validated_features)
        }
        inlier_stds = {
            feat: float(np.std(X_imputed[inlier_mask, idx])) + 1e-8
            for idx, feat in enumerate(validated_features)
        }

        # Build detailed anomalous row explanations
        anomalous_rows: list[dict[str, Any]] = []
        for i in range(n_samples):
            if is_anomaly[i]:
                row_raw_vals = {
                    feat: round(float(X_imputed[i, idx]), 4)
                    for idx, feat in enumerate(validated_features)
                }
                deviations: list[dict[str, Any]] = []
                for idx, feat in enumerate(validated_features):
                    val = float(X_imputed[i, idx])
                    mean_val = inlier_means[feat]
                    std_val = inlier_stds[feat]
                    z = (val - mean_val) / std_val

                    dev_sev = "high" if abs(z) >= 2.5 else ("medium" if abs(z) >= 1.5 else "low")
                    deviations.append({
                        "feature": feat,
                        "value": round(val, 4),
                        "inlier_mean": round(mean_val, 4),
                        "inlier_std": round(std_val, 4),
                        "z_score": round(float(z), 3),
                        "severity": dev_sev,
                    })

                # Sort deviations by magnitude of z-score
                deviations.sort(key=lambda d: abs(d["z_score"]), reverse=True)

                norm_s = float(normalized_scores[i])
                row_sev = "high" if norm_s >= 0.80 else ("medium" if norm_s >= 0.60 else "low")

                anomalous_rows.append({
                    "index": int(i),
                    "score": round(float(raw_scores[i]), 4),
                    "normalized_score": round(norm_s, 4),
                    "severity": row_sev,
                    "feature_values": row_raw_vals,
                    "top_deviations": deviations,
                })

        # Sort anomalous rows by anomaly severity (normalized score descending)
        anomalous_rows.sort(key=lambda r: r["normalized_score"], reverse=True)

        # 2D Projection for interactive scatter visualization
        pca_model: Optional[PCA] = None
        if len(validated_features) == 1:
            x_coords = np.arange(n_samples, dtype=float)
            y_coords = X_imputed[:, 0]
        elif len(validated_features) == 2:
            x_coords = X_imputed[:, 0]
            y_coords = X_imputed[:, 1]
        else:
            pca_model = PCA(n_components=2, random_state=42)
            coords = pca_model.fit_transform(X_scaled)
            x_coords = coords[:, 0]
            y_coords = coords[:, 1]

        # Assemble scatter points (capped to max 600 points for responsiveness, prioritizing anomalies)
        scatter_points: list[dict[str, Any]] = []
        anomaly_indices = set(np.where(is_anomaly)[0])
        normal_indices = [idx for idx in range(n_samples) if idx not in anomaly_indices]

        # Always include all anomalies
        for idx in anomaly_indices:
            scatter_points.append({
                "index": int(idx),
                "x": round(float(x_coords[idx]), 4),
                "y": round(float(y_coords[idx]), 4),
                "score": round(float(raw_scores[idx]), 4),
                "normalized_score": round(float(normalized_scores[idx]), 4),
                "is_anomaly": True,
            })

        # Subsample normals if large
        max_normals = max(50, 500 - len(anomaly_indices))
        if len(normal_indices) > max_normals:
            subsample_step = len(normal_indices) // max_normals
            sampled_normals = normal_indices[::subsample_step][:max_normals]
        else:
            sampled_normals = normal_indices

        for idx in sampled_normals:
            scatter_points.append({
                "index": int(idx),
                "x": round(float(x_coords[idx]), 4),
                "y": round(float(y_coords[idx]), 4),
                "score": round(float(raw_scores[idx]), 4),
                "normalized_score": round(float(normalized_scores[idx]), 4),
                "is_anomaly": False,
            })

        # Distribution buckets
        distribution_buckets = self._compute_distribution_buckets(raw_scores, is_anomaly)

        # Summary statistics
        summary_stats = {
            "inlier_means": inlier_means,
            "inlier_stds": inlier_stds,
            "contamination": contamination_val,
            "n_estimators": n_estimators,
            "explained_variance_ratio": (
                [round(float(v), 4) for v in pca_model.explained_variance_ratio_]
                if pca_model is not None
                else None
            ),
        }

        # Persist model artifact using joblib
        os.makedirs(settings.MODELS_DIR, exist_ok=True)
        artifact_filename = f"anomaly_{uuid.uuid4().hex}.joblib"
        artifact_path = os.path.join(settings.MODELS_DIR, artifact_filename)

        pipeline_data = {
            "features": validated_features,
            "contamination": contamination_val,
            "n_estimators": n_estimators,
            "model": model,
            "pca": pca_model,
            "inlier_means": inlier_means,
            "inlier_stds": inlier_stds,
            "threshold_score": threshold_val,
        }
        joblib.dump(pipeline_data, artifact_path)

        # Default run name
        model_name = (
            request.name.strip()
            if request.name and request.name.strip()
            else f"Isolation Forest ({len(validated_features)} features, {int(contamination_val * 100)}% rate)"
        )

        # Save to database
        db_model = anomaly_repository.create(
            db=db,
            dataset_id=dataset_id,
            user_id=user_id,
            name=model_name,
            contamination=contamination_val,
            n_estimators=n_estimators,
            feature_names=validated_features,
            use_cleaned=request.use_cleaned,
            n_samples=n_samples,
            n_anomalies=n_anomalies,
            anomaly_percentage=anomaly_pct,
            threshold_score=round(threshold_val, 4),
            score_min=round(s_min, 4),
            score_max=round(s_max, 4),
            score_mean=round(s_mean, 4),
            summary_stats=summary_stats,
            anomalous_rows=anomalous_rows,
            distribution_buckets=[b.model_dump() for b in distribution_buckets],
            scatter_points=scatter_points,
            artifact_path=artifact_path,
            status="completed",
        )

        return db_model

    def list_dataset_models(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> list[AnomalyModel]:
        """Lists anomaly detection models for a dataset with ownership check."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )
        return anomaly_repository.list_by_dataset(db, dataset_id=dataset_id, user_id=user_id)

    def get_anomaly_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> AnomalyModel:
        """Retrieves an anomaly model ensuring user ownership."""
        model = anomaly_repository.get_by_id_and_user(db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Anomaly model not found or access denied.",
            )
        return model

    def delete_anomaly_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> None:
        """Deletes an anomaly model record and unlinks its joblib artifact."""
        model = anomaly_repository.get_by_id_and_user(db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Anomaly model not found or access denied.",
            )

        if model.artifact_path and os.path.exists(model.artifact_path):
            try:
                os.remove(model.artifact_path)
            except OSError:
                pass

        anomaly_repository.delete(db, model)


anomaly_service = AnomalyDetectionService()
