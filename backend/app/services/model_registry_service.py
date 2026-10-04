import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Optional, Union

import joblib
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.model_registry import RegisteredModel
from app.repositories.dataset_repository import dataset_repository
from app.repositories.ml_repository import ml_repository
from app.repositories.model_registry_repository import model_registry_repository
from app.schemas.ml import MLPredictResponse
from app.schemas.model_registry import (
    RegisterModelRequest,
    RegisteredModelListResponse,
    RegisteredModelResponse,
)
from app.services.ml_service import execute_pipeline_prediction


class ModelRegistryService:
    def _get_registry_storage_dir(self) -> Path:
        registry_dir = Path(settings.MODELS_DIR) / "registry"
        registry_dir.mkdir(parents=True, exist_ok=True)
        return registry_dir

    def _to_response(self, model: RegisteredModel) -> RegisteredModelResponse:
        has_art = bool(model.artifact_path and os.path.exists(model.artifact_path))
        dataset_name = model.dataset.original_filename if model.dataset else None
        return RegisteredModelResponse(
            id=model.id,
            name=model.name,
            version=model.version,
            description=model.description,
            user_id=model.user_id,
            dataset_id=model.dataset_id,
            dataset_name=dataset_name,
            source_model_id=model.source_model_id,
            algorithm=model.algorithm,
            task_type=model.task_type,
            target_column=model.target_column,
            feature_names=model.feature_names or [],
            target_classes=model.target_classes,
            metrics=model.metrics or {},
            training_parameters=model.training_parameters or {},
            artifact_path=model.artifact_path,
            artifact_size_bytes=model.artifact_size_bytes,
            has_artifact=has_art,
            status=model.status,
            is_active=model.is_active,
            activated_at=model.activated_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def register_model(
        self,
        db: Session,
        user_id: int,
        request: RegisterModelRequest,
    ) -> RegisteredModelResponse:
        # 1. Validate dataset ownership
        dataset = dataset_repository.get_by_id_and_user(
            db=db, dataset_id=request.dataset_id, user_id=user_id
        )
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        # 2. Extract model properties (from source_model or explicit payload)
        if request.source_model_id is not None:
            source_model = ml_repository.get_model(
                db=db, model_id=request.source_model_id, user_id=user_id
            )
            if not source_model:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Source ML model not found or access denied.",
                )
            if source_model.dataset_id != request.dataset_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Source model does not belong to the specified dataset.",
                )
            if not source_model.artifact_path or not os.path.exists(source_model.artifact_path):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Source model artifact file is missing from disk storage.",
                )

            algorithm = source_model.algorithm
            task_type = source_model.task_type
            target_column = source_model.target_column
            feature_names = source_model.feature_names
            target_classes = source_model.target_classes
            metrics = source_model.metrics
            training_parameters = source_model.hyperparameters
            src_artifact = source_model.artifact_path
        else:
            # Explicit registration fields validation
            if not all([request.algorithm, request.task_type, request.target_column, request.feature_names, request.artifact_path]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="When registering without source_model_id, algorithm, task_type, target_column, feature_names, and artifact_path are required.",
                )
            if not os.path.exists(request.artifact_path):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Artifact file not found at {request.artifact_path}.",
                )
            algorithm = request.algorithm
            task_type = request.task_type
            target_column = request.target_column
            feature_names = request.feature_names
            target_classes = request.target_classes
            metrics = request.metrics or {}
            training_parameters = request.training_parameters or {}
            src_artifact = request.artifact_path

        # 3. Compute monotonic version for (user_id, model_name)
        next_version = model_registry_repository.get_next_version(
            db=db, user_id=user_id, name=request.name
        )

        # 4. Safely copy artifact to dedicated registry storage
        registry_dir = self._get_registry_storage_dir()
        safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in request.name)
        dest_filename = f"registry_{safe_name}_v{next_version}_{uuid.uuid4().hex[:8]}.joblib"
        dest_artifact_path = registry_dir / dest_filename
        try:
            shutil.copyfile(src_artifact, dest_artifact_path)
            artifact_size = os.path.getsize(dest_artifact_path)
        except Exception as copy_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to copy model artifact to registry: {str(copy_err)}",
            )

        # 5. Persist registered model
        registered = model_registry_repository.create(
            db=db,
            name=request.name,
            version=next_version,
            user_id=user_id,
            dataset_id=request.dataset_id,
            source_model_id=request.source_model_id,
            algorithm=algorithm,
            task_type=task_type,
            target_column=target_column,
            feature_names=feature_names,
            target_classes=target_classes,
            metrics=metrics,
            training_parameters=training_parameters,
            artifact_path=str(dest_artifact_path),
            artifact_size_bytes=artifact_size,
            description=request.description,
            is_active=request.set_active,
        )

        return self._to_response(registered)

    def list_models(
        self,
        db: Session,
        user_id: int,
        dataset_id: Optional[int] = None,
        name: Optional[str] = None,
        task_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> RegisteredModelListResponse:
        models = model_registry_repository.list_models(
            db=db,
            user_id=user_id,
            dataset_id=dataset_id,
            name=name,
            task_type=task_type,
            is_active=is_active,
            limit=limit,
            offset=offset,
        )
        total = model_registry_repository.count_models(
            db=db,
            user_id=user_id,
            dataset_id=dataset_id,
            name=name,
            task_type=task_type,
            is_active=is_active,
        )

        # If no models are registered yet, auto-register available trained ML models for this user
        if total == 0:
            from sqlalchemy import select, desc
            from app.models.ml import MLModel
            stmt = (
                select(MLModel)
                .where(MLModel.user_id == user_id)
                .order_by(desc(MLModel.is_best), desc(MLModel.created_at))
            )
            if dataset_id:
                stmt = stmt.where(MLModel.dataset_id == dataset_id)
            trained_candidates = db.execute(stmt).scalars().all()
            for cand in trained_candidates:
                if cand.artifact_path and os.path.exists(cand.artifact_path):
                    try:
                        cand_dataset = cand.dataset
                        ds_name = cand_dataset.original_filename if cand_dataset else "Dataset"
                        self.register_model(
                            db=db,
                            user_id=user_id,
                            request=RegisterModelRequest(
                                name=f"{ds_name} - {cand.target_column} Predictor",
                                dataset_id=cand.dataset_id,
                                source_model_id=cand.id,
                                description=f"Saved model ({cand.algorithm}) predicting {cand.target_column}",
                                set_active=True,
                            ),
                        )
                    except Exception:
                        pass

            models = model_registry_repository.list_models(
                db=db,
                user_id=user_id,
                dataset_id=dataset_id,
                name=name,
                task_type=task_type,
                is_active=is_active,
                limit=limit,
                offset=offset,
            )
            total = model_registry_repository.count_models(
                db=db,
                user_id=user_id,
                dataset_id=dataset_id,
                name=name,
                task_type=task_type,
                is_active=is_active,
            )

        return RegisteredModelListResponse(
            items=[self._to_response(m) for m in models],
            total=total,
        )

    def get_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> RegisteredModelResponse:
        model = model_registry_repository.get(db=db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registered model not found or access denied.",
            )
        return self._to_response(model)

    def activate_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> RegisteredModelResponse:
        model = model_registry_repository.get(db=db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registered model not found or access denied.",
            )

        # Validate artifact integrity before activation
        if not model.artifact_path or not os.path.exists(model.artifact_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot activate model: Artifact file is missing from disk storage.",
            )

        activated = model_registry_repository.activate_model(db=db, model=model)
        return self._to_response(activated)

    def rollback_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
        target_version: Optional[int] = None,
    ) -> RegisteredModelResponse:
        current_model = model_registry_repository.get(db=db, model_id=model_id, user_id=user_id)
        if not current_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registered model not found or access denied.",
            )

        if target_version is not None:
            if target_version == current_model.version:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Model is already on version {target_version}.",
                )
            target_model = model_registry_repository.get_by_name_and_version(
                db=db, user_id=user_id, name=current_model.name, version=target_version
            )
        else:
            target_model = model_registry_repository.get_previous_version(
                db=db,
                user_id=user_id,
                name=current_model.name,
                current_version=current_model.version,
            )

        if not target_model:
            version_str = f"version {target_version}" if target_version else "previous version"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No {version_str} available to roll back to for model '{current_model.name}'.",
            )

        # Validate target artifact integrity before rollback
        if not target_model.artifact_path or not os.path.exists(target_model.artifact_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot rollback to version {target_model.version}: Artifact file is missing from disk storage.",
            )

        activated = model_registry_repository.activate_model(db=db, model=target_model)
        return self._to_response(activated)

    def delete_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> dict[str, Any]:
        model = model_registry_repository.get(db=db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registered model not found or access denied.",
            )

        artifact_to_cleanup = model.artifact_path
        name = model.name
        version = model.version

        # Delete database record
        model_registry_repository.delete(db=db, model=model)

        # Safely clean up artifact from disk if no other record references it
        if artifact_to_cleanup:
            ref_count = model_registry_repository.count_by_artifact_path(
                db=db, artifact_path=artifact_to_cleanup
            )
            if ref_count == 0 and os.path.exists(artifact_to_cleanup):
                try:
                    os.remove(artifact_to_cleanup)
                except OSError:
                    pass

        return {
            "message": f"Model '{name}' version {version} and associated artifacts safely deleted.",
            "deleted_id": model_id,
            "name": name,
            "version": version,
        }

    def get_active_model(
        self,
        db: Session,
        user_id: int,
        name: Optional[str] = None,
        dataset_id: Optional[int] = None,
    ) -> RegisteredModelResponse:
        model = model_registry_repository.get_active_model(
            db=db, user_id=user_id, name=name, dataset_id=dataset_id
        )
        if not model:
            detail = "No active model found"
            if name:
                detail += f" with name '{name}'"
            if dataset_id:
                detail += f" for dataset {dataset_id}"
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

        return self._to_response(model)

    def predict(
        self,
        db: Session,
        model_id: int,
        user_id: int,
        inputs: Union[dict[str, Any], list[dict[str, Any]]],
    ) -> MLPredictResponse:
        model = model_registry_repository.get(db=db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registered model not found or access denied.",
            )
        if not model.artifact_path or not os.path.exists(model.artifact_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
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
            model_name=f"{model.name} (v{model.version})",
        )

    def predict_active(
        self,
        db: Session,
        user_id: int,
        inputs: Union[dict[str, Any], list[dict[str, Any]]],
        name: Optional[str] = None,
        dataset_id: Optional[int] = None,
    ) -> MLPredictResponse:
        model = model_registry_repository.get_active_model(
            db=db, user_id=user_id, name=name, dataset_id=dataset_id
        )
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active registered model found to execute prediction.",
            )
        if not model.artifact_path or not os.path.exists(model.artifact_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Active model artifact file is missing from disk storage.",
            )

        pipeline = joblib.load(model.artifact_path)
        return execute_pipeline_prediction(
            pipeline=pipeline,
            task_type=model.task_type,
            feature_names=model.feature_names,
            target_classes=model.target_classes,
            inputs=inputs,
            model_id=model.id,
            model_name=f"{model.name} (v{model.version} [ACTIVE])",
        )


model_registry_service = ModelRegistryService()
