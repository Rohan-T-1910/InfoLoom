from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.ml import MLPredictRequest, MLPredictResponse
from app.schemas.model_registry import (
    RegisterModelRequest,
    RegisteredModelListResponse,
    RegisteredModelResponse,
    RollbackModelRequest,
)
from app.services.model_registry_service import model_registry_service

router = APIRouter(prefix="/models/registry", tags=["Model Registry"])


@router.post(
    "",
    response_model=RegisteredModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a trained model version into the Model Registry",
)
def register_model(
    request: RegisterModelRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Registers a model version into the centralized Model Registry.
    Can be created directly from a trained MLModel from Phase 4 or with custom metadata.
    Automatically assigns monotonically increasing version numbers, isolates artifact storage,
    and handles automatic activation.
    """
    return model_registry_service.register_model(
        db=db,
        user_id=current_user.id,
        request=request,
    )


@router.get(
    "",
    response_model=RegisteredModelListResponse,
    summary="List registered models and versions",
)
def list_registered_models(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    dataset_id: Annotated[Optional[int], Query(description="Filter by dataset ID")] = None,
    name: Annotated[Optional[str], Query(description="Filter by model family name")] = None,
    task_type: Annotated[Optional[str], Query(description="Filter by task type (regression/classification)")] = None,
    is_active: Annotated[Optional[bool], Query(description="Filter by active status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Retrieves all registered model versions matching optional dataset and algorithm filters."""
    return model_registry_service.list_models(
        db=db,
        user_id=current_user.id,
        dataset_id=dataset_id,
        name=name,
        task_type=task_type,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/active",
    response_model=RegisteredModelResponse,
    summary="Get currently active model version",
)
def get_active_model(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    name: Annotated[Optional[str], Query(description="Filter by model family name")] = None,
    dataset_id: Annotated[Optional[int], Query(description="Filter by dataset ID")] = None,
):
    """Retrieves the active model version designated for real-time inference."""
    return model_registry_service.get_active_model(
        db=db,
        user_id=current_user.id,
        name=name,
        dataset_id=dataset_id,
    )


@router.post(
    "/active/predict",
    response_model=MLPredictResponse,
    summary="Execute inference using the currently active model",
)
def predict_with_active_model(
    request: MLPredictRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    name: Annotated[Optional[str], Query(description="Filter by model family name")] = None,
    dataset_id: Annotated[Optional[int], Query(description="Filter by dataset ID")] = None,
):
    """Executes prediction on input features using the currently active model version in the registry."""
    return model_registry_service.predict_active(
        db=db,
        user_id=current_user.id,
        inputs=request.inputs,
        name=name,
        dataset_id=dataset_id,
    )


@router.get(
    "/{model_id}",
    response_model=RegisteredModelResponse,
    summary="Get details of a registered model version",
)
def get_registered_model(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieves comprehensive parameters, performance metrics, and artifact status for a model version."""
    return model_registry_service.get_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )


@router.post(
    "/{model_id}/activate",
    response_model=RegisteredModelResponse,
    summary="Activate a model version for production prediction",
)
def activate_model_version(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Activates the specified model version.
    Validates artifact integrity and automatically deactivates previous versions of the same model family.
    """
    return model_registry_service.activate_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )


@router.post(
    "/{model_id}/rollback",
    response_model=RegisteredModelResponse,
    summary="Roll back to a previous model version",
)
def rollback_model_version(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    request: Optional[RollbackModelRequest] = None,
):
    """
    Rolls back to the previous version (or specific target_version) of the model family.
    Ensures target artifact is verified and intact before activation.
    """
    target_version = request.target_version if request else None
    return model_registry_service.rollback_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
        target_version=target_version,
    )


@router.delete(
    "/{model_id}",
    summary="Delete a model version and clean up its artifacts",
)
def delete_model_version(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Permanently deletes a registered model version from the registry
    and safely cleans up the physical artifact file from disk storage.
    """
    return model_registry_service.delete_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )


@router.post(
    "/{model_id}/predict",
    response_model=MLPredictResponse,
    summary="Execute inference using a specific registered model version",
)
def predict_with_registered_model(
    model_id: int,
    request: MLPredictRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Executes prediction on input features against a specific model version."""
    return model_registry_service.predict(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
        inputs=request.inputs,
    )
