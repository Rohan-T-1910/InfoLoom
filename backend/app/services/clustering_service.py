import os
import uuid
from typing import Any, Optional
import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.clustering import ClusteringModel
from app.repositories.clustering_repository import clustering_repository
from app.repositories.dataset_repository import dataset_repository
from app.schemas.clustering import (
    ClusterFeatureStat,
    ClusteringDataPoint,
    ClusteringEvaluationRequest,
    ClusteringEvaluationResponse,
    ClusteringFeatureInfo,
    ClusteringFeaturesResponse,
    ClusteringRunRequest,
    ClusterProfile,
    KMeansKMetric,
)
from app.services.validation_service import validation_service


class ClusteringService:
    """Service providing K-Means clustering, elbow and silhouette evaluation,

    and multi-tenant segmentation profiling for InfoLoom.
    """

    def get_clustering_features(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        use_cleaned: bool = True,
    ) -> ClusteringFeaturesResponse:
        """Inspects a dataset and returns candidate numeric features suitable for distance-based clustering."""
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
        numeric_features: list[ClusteringFeatureInfo] = []
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

                info = ClusteringFeatureInfo(
                    name=str(col),
                    data_type=str(df[col].dtype),
                    non_null_count=non_null_count,
                    missing_count=missing_count,
                    mean=mean_val,
                    std=std_val,
                    min=min_val,
                    max=max_val,
                )
                numeric_features.append(info)

                # Avoid recommending primary keys or zero-variance columns
                col_lower = str(col).lower()
                is_id = col_lower == "id" or col_lower.endswith("_id")
                has_variance = std_val is not None and std_val > 0
                not_too_sparse = missing_count < (len(df) * 0.5)

                if has_variance and not_too_sparse and not (is_id and series.nunique() == len(series)):
                    recommended_features.append(str(col))

        return ClusteringFeaturesResponse(
            dataset_id=dataset_id,
            is_cleaned=bool(use_cleaned and dataset.has_cleaned),
            total_rows=len(df),
            numeric_features=numeric_features,
            recommended_features=recommended_features,
        )

    def _prepare_and_validate_features(
        self,
        df: pd.DataFrame,
        features: list[str],
    ) -> tuple[np.ndarray, np.ndarray, list[str]]:
        """Validates feature availability and numeric type, imputes missing values with median,

        and standardizes features with StandardScaler.
        Returns:
            X_imputed (in original scale), X_scaled (standardized), validated feature list
        """
        if not features:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one numeric feature must be selected for clustering.",
            )

        for f in features:
            if f not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Feature '{f}' does not exist in dataset.",
                )
            if not pd.api.types.is_numeric_dtype(df[f]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Feature '{f}' is not numeric and cannot be used for distance-based clustering.",
                )

        if len(df) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset has too few samples for clustering (minimum 3 rows required).",
            )

        X_df = df[features].copy()

        # Handle missing values: SimpleImputer with median
        imputer = SimpleImputer(strategy="median")
        X_imputed = imputer.fit_transform(X_df)

        # Handle zero-variance columns if any
        stds = np.std(X_imputed, axis=0)
        zero_var_indices = np.where(stds == 0)[0]
        if len(zero_var_indices) == len(features):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All selected features have zero variance. Clustering requires varying values.",
            )

        # Scale features using StandardScaler
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_imputed)

        return X_imputed, X_scaled, features

    def evaluate_clustering(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        request: ClusteringEvaluationRequest,
    ) -> ClusteringEvaluationResponse:
        """Calculates inertia (elbow method) and silhouette scores across a range of K values."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        file_path = (
            dataset.cleaned_file_path
            if (request.use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
            else dataset.file_path
        )
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)
        X_imputed, X_scaled, validated_features = self._prepare_and_validate_features(
            df=df, features=request.features
        )

        n_samples = len(X_scaled)
        if request.k_min < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum K for evaluation must be at least 2.",
            )

        if request.k_min >= n_samples:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"k_min ({request.k_min}) must be strictly less than sample size ({n_samples}).",
            )

        effective_k_max = min(request.k_max, n_samples - 1, 15)
        if request.k_min > effective_k_max:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid K range: k_min ({request.k_min}) cannot exceed effective k_max ({effective_k_max}).",
            )

        k_metrics: list[KMeansKMetric] = []
        best_silhouette = -2.0
        best_k = request.k_min

        for k in range(request.k_min, effective_k_max + 1):
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            km.fit(X_scaled)
            labels = km.labels_
            inertia = float(km.inertia_)

            sil: Optional[float] = None
            if len(np.unique(labels)) > 1 and n_samples > k:
                try:
                    sil = float(silhouette_score(X_scaled, labels))
                    if sil > best_silhouette:
                        best_silhouette = sil
                        best_k = k
                except Exception:
                    sil = None

            k_metrics.append(KMeansKMetric(k=k, inertia=round(inertia, 4), silhouette_score=round(sil, 4) if sil is not None else None))

        suggestion_reason = (
            f"K={best_k} achieves the highest silhouette score ({best_silhouette:.4f}), indicating well-separated, cohesive clusters."
            if best_silhouette > -1.0
            else f"K={best_k} provides a balanced clustering partition for the sample size."
        )

        return ClusteringEvaluationResponse(
            features=validated_features,
            n_samples=n_samples,
            k_metrics=k_metrics,
            suggested_k=best_k,
            suggestion_reason=suggestion_reason,
        )

    def run_clustering(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        request: ClusteringRunRequest,
    ) -> ClusteringModel:
        """Fits K-Means with preprocessing pipeline, generates segment profiles,

        records 2D scatter coordinates, and persists artifacts.
        """
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        file_path = (
            dataset.cleaned_file_path
            if (request.use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
            else dataset.file_path
        )
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)
        X_imputed, X_scaled, validated_features = self._prepare_and_validate_features(
            df=df, features=request.features
        )

        n_samples = len(X_scaled)
        if request.k < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of clusters K must be at least 2.",
            )
        if request.k >= n_samples:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Number of clusters K ({request.k}) must be strictly less than sample size ({n_samples}).",
            )

        # Build pipeline and fit
        imputer = SimpleImputer(strategy="median")
        scaler = StandardScaler()
        kmeans = KMeans(n_clusters=request.k, random_state=42, n_init=10)

        pipeline = Pipeline([
            ("imputer", imputer),
            ("scaler", scaler),
            ("kmeans", kmeans),
        ])

        pipeline.fit(df[validated_features])
        labels = kmeans.labels_
        inertia = float(kmeans.inertia_)

        # Silhouette score
        sil_score: Optional[float] = None
        if len(np.unique(labels)) > 1 and n_samples > request.k:
            try:
                sil_score = round(float(silhouette_score(X_scaled, labels)), 4)
            except Exception:
                sil_score = None

        # Reconstructed cluster centers in original feature scale
        centers_original = scaler.inverse_transform(kmeans.cluster_centers_)
        cluster_centers_dict: dict[str, list[float]] = {}
        for idx, feat in enumerate(validated_features):
            cluster_centers_dict[feat] = [round(float(val), 4) for val in centers_original[:, idx]]

        # Generate cluster profiles
        df_imputed = pd.DataFrame(X_imputed, columns=validated_features)
        df_imputed["cluster"] = labels

        cluster_profiles: list[dict[str, Any]] = []
        global_means = df_imputed[validated_features].mean()

        for c in range(request.k):
            sub = df_imputed[df_imputed["cluster"] == c]
            size = len(sub)
            percentage = round((size / n_samples) * 100, 2) if n_samples > 0 else 0.0

            stats_list: list[dict[str, Any]] = []
            descriptor_parts: list[str] = []

            for feat in validated_features:
                col_series = sub[feat]
                m = float(col_series.mean())
                med = float(col_series.median())
                s = float(col_series.std()) if size > 1 else 0.0
                mn = float(col_series.min())
                mx = float(col_series.max())

                stats_list.append({
                    "feature": feat,
                    "mean": round(m, 4),
                    "median": round(med, 4),
                    "std": round(s, 4),
                    "min": round(mn, 4),
                    "max": round(mx, 4),
                })

                # Comparative tag
                g_mean = float(global_means[feat])
                if g_mean != 0:
                    diff_pct = (m - g_mean) / abs(g_mean)
                    if diff_pct >= 0.2:
                        descriptor_parts.append(f"High {feat}")
                    elif diff_pct <= -0.2:
                        descriptor_parts.append(f"Low {feat}")

            descriptor_str = f"Cluster {c}"
            if descriptor_parts:
                descriptor_str += f" ({', '.join(descriptor_parts[:2])})"

            cluster_profiles.append({
                "cluster_id": c,
                "name": descriptor_str,
                "size": size,
                "percentage": percentage,
                "stats": stats_list,
            })

        # Generate 2D sample assignments for visualization
        sample_assignments: list[dict[str, Any]] = []
        # Cap visualization samples to 500 rows if dataset is massive
        step = max(1, len(df_imputed) // 500)
        sample_indices = range(0, len(df_imputed), step)

        feat_x = validated_features[0]
        feat_y = validated_features[1] if len(validated_features) > 1 else validated_features[0]

        for i in sample_indices:
            row_dict = {f: round(float(df_imputed.at[i, f]), 4) for f in validated_features}
            sample_assignments.append({
                "index": int(i),
                "cluster": int(df_imputed.at[i, "cluster"]),
                "x": round(float(df_imputed.at[i, feat_x]), 4),
                "y": round(float(df_imputed.at[i, feat_y]), 4),
                "features": row_dict,
            })

        # Calculate elbow metrics (k=2..max) to store for the report
        eval_k_max = min(8, n_samples - 1)
        evaluation_curve: list[dict[str, Any]] = []
        if eval_k_max >= 2:
            for k_eval in range(2, eval_k_max + 1):
                temp_km = KMeans(n_clusters=k_eval, random_state=42, n_init=10)
                temp_km.fit(X_scaled)
                temp_sil: Optional[float] = None
                if len(np.unique(temp_km.labels_)) > 1:
                    try:
                        temp_sil = round(float(silhouette_score(X_scaled, temp_km.labels_)), 4)
                    except Exception:
                        temp_sil = None
                evaluation_curve.append({
                    "k": k_eval,
                    "inertia": round(float(temp_km.inertia_), 4),
                    "silhouette_score": temp_sil,
                })

        # Persist model artifact
        os.makedirs(settings.MODELS_DIR, exist_ok=True)
        artifact_filename = f"clustering_{uuid.uuid4().hex}.joblib"
        artifact_path = os.path.join(settings.MODELS_DIR, artifact_filename)
        joblib.dump(pipeline, artifact_path)

        model_name = request.name or f"K-Means (k={request.k})"

        # Persist in DB
        clustering_model = clustering_repository.create(
            db=db,
            dataset_id=dataset_id,
            user_id=user_id,
            name=model_name,
            k=request.k,
            feature_names=validated_features,
            use_cleaned=bool(request.use_cleaned and dataset.has_cleaned),
            n_samples=n_samples,
            inertia=round(inertia, 4),
            silhouette_score=sil_score,
            cluster_centers=cluster_centers_dict,
            cluster_profiles=cluster_profiles,
            evaluation_metrics={"curve": evaluation_curve},
            sample_assignments=sample_assignments,
            artifact_path=artifact_path,
            status="completed",
        )

        return clustering_model

    def get_clustering_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> ClusteringModel:
        """Retrieves a specific clustering model with strict tenant ownership validation."""
        model = clustering_repository.get_by_id_and_user(db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clustering model not found or access denied.",
            )
        return model

    def list_dataset_models(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> list[ClusteringModel]:
        """Lists clustering models for a dataset with strict tenant ownership validation."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )
        return clustering_repository.list_by_dataset(db, dataset_id=dataset_id, user_id=user_id)

    def delete_clustering_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> None:
        """Deletes a clustering model and its on-disk serialized artifact."""
        model = clustering_repository.get_by_id_and_user(db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clustering model not found or access denied.",
            )

        if model.artifact_path and os.path.exists(model.artifact_path):
            try:
                os.remove(model.artifact_path)
            except OSError:
                pass

        clustering_repository.delete(db, model)


clustering_service = ClusteringService()
