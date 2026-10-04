import os
import uuid
from pathlib import Path
from typing import Any, Optional, Union
from fastapi import BackgroundTasks, HTTPException, status
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import session as session_module
from app.models.dataset import Dataset
from app.models.ml import MLJob, MLModel
from app.repositories.dataset_repository import dataset_repository
from app.repositories.ml_repository import ml_repository
from app.schemas.ml import (
    MLJobResponse,
    MLPredictResponse,
    MLTargetInspectionResponse,
    MLTrainRequest,
)
from app.services.column_classifier import column_classifier
from app.services.ml_pipeline import MLPipelineBuilder
from app.services.validation_service import validation_service


class MLService:
    """
    Coordinates machine learning pipelines, multi-model leaderboard training,
    background job execution, and artifact inference with strict multi-tenancy.
    """

    def inspect_target(
        self, db: Session, dataset_id: int, user_id: int, target_column: str
    ) -> MLTargetInspectionResponse:
        """Inspects target column characteristics to guide frontend task selection."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")

        file_path = dataset.cleaned_file_path if (dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path)) else dataset.file_path
        df = validation_service.read_dataset_df(file_path)

        if target_column not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{target_column}' not found in dataset.",
            )

        target_series = df[target_column].dropna()
        if len(target_series) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{target_column}' contains only missing values.",
            )

        unique_count = int(target_series.nunique())
        is_numeric = pd.api.types.is_numeric_dtype(target_series)

        # Infer task type
        if not is_numeric or (unique_count <= 10 and unique_count < len(target_series) * 0.2):
            inferred_task = "classification"
        else:
            inferred_task = "regression"

        sample_vals = [val for val in target_series.unique()[:10]]
        # Convert numpy types to python native
        sample_vals = [int(v) if isinstance(v, (np.integer, int)) else float(v) if isinstance(v, (np.floating, float)) else str(v) for v in sample_vals]

        candidate_features = [
            c for c in df.columns
            if c != target_column and not column_classifier.is_identifier(c, df[c])
        ]

        warning = None
        is_supported = True
        if inferred_task == "classification" and unique_count < 2:
            is_supported = False
            warning = "Target has only 1 unique class. Classification requires at least 2 distinct classes."
        elif inferred_task == "regression" and not is_numeric:
            is_supported = False
            warning = "Regression target must be numeric."

        return MLTargetInspectionResponse(
            target_column=target_column,
            inferred_task_type=inferred_task,
            unique_count=unique_count,
            sample_values=sample_vals,
            candidate_features=candidate_features,
            is_supported=is_supported,
            warning=warning,
        )

    def create_and_enqueue_training_job(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        request: MLTrainRequest,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> MLJob:
        """Validates inputs, initializes an MLJob record, and triggers training asynchronously."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")

        # Determine source file
        use_cleaned = bool(request.use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
        file_path = dataset.cleaned_file_path if use_cleaned else dataset.file_path

        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)

        # Validate target column
        if request.target_column not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{request.target_column}' does not exist in dataset.",
            )

        # Validate task type compatibility
        target_series = df[request.target_column].dropna()
        if len(target_series) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset has too few valid samples for ML training (minimum 10 rows required).",
            )

        if request.task_type == "regression" and not pd.api.types.is_numeric_dtype(target_series):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{request.target_column}' is not numeric, which is incompatible with regression.",
            )

        if request.task_type == "classification" and target_series.nunique() < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Classification requires at least 2 distinct target classes.",
            )

        # Validate / resolve feature columns
        if request.feature_columns:
            invalid_cols = [c for c in request.feature_columns if c not in df.columns]
            if invalid_cols:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Features not present in dataset: {invalid_cols}",
                )
            feature_cols = [c for c in request.feature_columns if c != request.target_column]
        else:
            feature_cols = [
                c for c in df.columns if c != request.target_column and not str(c).lower().endswith("id")
            ]

        if not feature_cols:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one predictive feature column is required for training.",
            )

        # Create persistent job in pending state
        job = ml_repository.create_job(
            db=db,
            dataset_id=dataset_id,
            user_id=user_id,
            task_type=request.task_type,
            target_column=request.target_column,
            feature_columns=feature_cols,
            test_size=request.test_size,
            use_cleaned=use_cleaned,
            status="pending",
        )

        # Enqueue background task or execute synchronously if no background_tasks runner provided
        if background_tasks is not None:
            background_tasks.add_task(
                self.execute_training_job,
                job_id=job.id,
                cv_folds=request.cv_folds,
                algorithms=request.algorithms,
            )
        else:
            self.execute_training_job(
                job_id=job.id,
                cv_folds=request.cv_folds,
                algorithms=request.algorithms,
            )

        return job

    def execute_training_job(
        self,
        job_id: int,
        cv_folds: int = 5,
        algorithms: Optional[list[str]] = None,
    ) -> None:
        """
        Executes ML training in background context:
        - Reads dataset and drops missing targets
        - Encodes target (if classification)
        - Performs split strictly before pipeline fitting (preventing data leakage)
        - Trains multi-model comparison suite
        - Serializes model artifacts via joblib
        - Computes cross-validation and evaluation metrics
        - Updates job leaderboard and identifies top model
        """
        db = session_module.SessionLocal()
        try:
            job = db.get(MLJob, job_id)
            if not job:
                return

            ml_repository.update_job_status(db, job_id, "running")

            dataset = dataset_repository.get_by_id_and_user(db, dataset_id=job.dataset_id, user_id=job.user_id)
            if not dataset:
                ml_repository.update_job_failed(db, job_id, "Associated dataset not found.")
                return

            file_path = dataset.cleaned_file_path if (job.use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path)) else dataset.file_path
            df = validation_service.read_dataset_df(file_path)

            # Drop missing targets
            clean_df = df.dropna(subset=[job.target_column]).copy()
            if len(clean_df) < 8:
                ml_repository.update_job_failed(db, job_id, "Insufficient non-null target samples for model training.")
                return

            X = clean_df[job.feature_columns].copy()
            y_raw = clean_df[job.target_column]

            target_classes: Optional[list[Any]] = None
            if job.task_type == "classification":
                label_encoder = LabelEncoder()
                y = label_encoder.fit_transform(y_raw.astype(str))
                target_classes = [str(c) for c in label_encoder.classes_]
            else:
                y = y_raw.astype(float).values

            # Train/test split with stratify for classification if min class count permits
            stratify = None
            if job.task_type == "classification":
                class_counts = pd.Series(y).value_counts()
                if class_counts.min() >= 2:
                    stratify = y

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=job.test_size, random_state=42, stratify=stratify
            )

            numeric_features, categorical_features = MLPipelineBuilder.identify_feature_types(
                X_train, job.feature_columns
            )

            # Determine algorithms to run
            if algorithms:
                algo_list = algorithms
            else:
                if job.task_type == "regression":
                    algo_list = ["linear", "random_forest", "xgboost"]
                else:
                    algo_list = ["logistic", "random_forest", "xgboost"]

            # Ensure models storage directory exists
            models_dir = Path(settings.MODELS_DIR)
            models_dir.mkdir(parents=True, exist_ok=True)

            trained_models: list[MLModel] = []

            # Adjust CV folds if sample size is small
            actual_cv = min(cv_folds, max(2, len(X_train) // 4))

            for algo in algo_list:
                try:
                    name, full_pipeline, metrics, hyperparameters = MLPipelineBuilder.train_and_evaluate(
                        task_type=job.task_type,
                        algorithm=algo,
                        X_train=X_train,
                        X_test=X_test,
                        y_train=y_train,
                        y_test=y_test,
                        numeric_features=numeric_features,
                        categorical_features=categorical_features,
                        cv_folds=actual_cv,
                        target_classes=target_classes,
                    )

                    # Persist trained model artifact using joblib
                    artifact_filename = f"model_{job.id}_{algo}_{uuid.uuid4().hex[:8]}.joblib"
                    artifact_path = models_dir / artifact_filename
                    joblib.dump(full_pipeline, artifact_path)

                    model_record = ml_repository.create_model(
                        db=db,
                        job_id=job.id,
                        dataset_id=job.dataset_id,
                        user_id=job.user_id,
                        name=name,
                        algorithm=algo,
                        task_type=job.task_type,
                        target_column=job.target_column,
                        feature_names=job.feature_columns,
                        target_classes=target_classes,
                        metrics=metrics,
                        hyperparameters=hyperparameters,
                        artifact_path=str(artifact_path),
                        is_best=False,
                    )
                    trained_models.append(model_record)
                except Exception as model_err:
                    # Continue training other models if one encounters an error
                    continue

            if not trained_models:
                ml_repository.update_job_failed(db, job_id, "All model training algorithms failed to converge.")
                return

            # Sort leaderboard
            # For regression: higher R² is better
            # For classification: higher F1 is better
            trained_models.sort(
                key=lambda m: m.metrics.get("primary_metric", 0.0),
                reverse=True,
            )

            # Mark best model
            best_model = trained_models[0]
            best_model.is_best = True
            db.commit()

            # Auto-register top model into Saved Models
            try:
                from app.schemas.model_registry import RegisterModelRequest
                from app.services.model_registry_service import model_registry_service
                clean_name = f"{dataset.original_filename or 'Dataset'} - {best_model.target_column} Predictor"
                model_registry_service.register_model(
                    db=db,
                    user_id=job.user_id,
                    request=RegisterModelRequest(
                        name=clean_name,
                        dataset_id=job.dataset_id,
                        source_model_id=best_model.id,
                        description=f"Auto-saved best model ({best_model.algorithm}) predicting {best_model.target_column}",
                        set_active=True,
                    ),
                )
            except Exception as reg_err:
                pass

            leaderboard = [
                {
                    "id": m.id,
                    "name": m.name,
                    "algorithm": m.algorithm,
                    "task_type": m.task_type,
                    "metrics": m.metrics,
                    "hyperparameters": m.hyperparameters,
                    "is_best": m.is_best,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in trained_models
            ]

            ml_repository.update_job_completed(
                db=db,
                job_id=job_id,
                leaderboard=leaderboard,
                best_model_id=best_model.id,
            )

        except Exception as e:
            ml_repository.update_job_failed(db, job_id, f"Training job failed: {str(e)}")
        finally:
            db.close()

    def predict(
        self,
        db: Session,
        model_id: int,
        user_id: int,
        inputs: Union[dict[str, Any], list[dict[str, Any]]],
    ) -> MLPredictResponse:
        """
        Loads saved model pipeline artifact via joblib,
        validates input feature schema, and generates predictions.
        """
        model = ml_repository.get_model(db=db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trained model not found.")

        if not os.path.exists(model.artifact_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model artifact file is missing from disk storage.",
            )

        pipeline = joblib.load(model.artifact_path)
        return execute_pipeline_prediction(
            pipeline=pipeline,
            task_type=model.task_type,
            feature_names=model.feature_names,
            target_classes=model.target_classes,
            inputs=inputs,
            model_id=model.id,
            model_name=model.name,
        )


def execute_pipeline_prediction(
    pipeline: Any,
    task_type: str,
    feature_names: list[str],
    target_classes: Optional[list[Any]],
    inputs: Union[dict[str, Any], list[dict[str, Any]]],
    model_id: int,
    model_name: str,
) -> MLPredictResponse:
    """
    Shared, leak-free pipeline inference executor.
    Standardizes input dictionaries, aligns feature columns, runs predict / predict_proba,
    and formats the standardized MLPredictResponse.
    """
    raw_list = [inputs] if isinstance(inputs, dict) else inputs
    if not raw_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prediction inputs list cannot be empty.",
        )

    # Construct DataFrame ensuring all expected feature columns exist
    df_input = pd.DataFrame(raw_list)
    for col in feature_names:
        if col not in df_input.columns:
            df_input[col] = np.nan

    # Align column order exactly
    df_input = df_input[feature_names]

    # Generate predictions
    raw_predictions = pipeline.predict(df_input)

    # Map predictions back to original class labels for classification if available
    if task_type == "classification" and target_classes:
        classes = target_classes
        predictions = [
            classes[int(p)] if 0 <= int(p) < len(classes) else p
            for p in raw_predictions
        ]
    else:
        predictions = [
            float(round(p, 4)) if isinstance(p, (np.floating, float)) else p
            for p in raw_predictions
        ]

    probabilities = None
    if task_type == "classification" and hasattr(pipeline, "predict_proba"):
        try:
            proba_array = pipeline.predict_proba(df_input)
            classes = target_classes if target_classes else [str(i) for i in range(proba_array.shape[1])]
            probabilities = [
                {str(classes[i]): float(round(prob, 4)) for i, prob in enumerate(row)}
                for row in proba_array
            ]
        except Exception:
            probabilities = None

    return MLPredictResponse(
        model_id=model_id,
        model_name=model_name,
        task_type=task_type,
        predictions=predictions,
        probabilities=probabilities,
        feature_names=feature_names,
    )


ml_service = MLService()
