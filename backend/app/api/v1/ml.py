from typing import Annotated, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories.ml_repository import ml_repository
from app.schemas.ml import (
    MLJobResponse,
    MLModelDetailResponse,
    MLModelLeaderboardItem,
    MLPredictRequest,
    MLPredictResponse,
    MLTargetInspectionResponse,
    MLTrainRequest,
)
from app.services.ml_service import ml_service

router = APIRouter(tags=["Machine Learning"])


# --- Dataset Training Endpoints ---
@router.post(
    "/datasets/{dataset_id}/train",
    response_model=MLJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue background ML training job for dataset",
)
def train_models(
    dataset_id: int,
    request: MLTrainRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Triggers asynchronous model training suite:
    - Trains task-appropriate models (Linear/Logistic, Random Forest, XGBoost)
    - Reusable, leak-free preprocessing pipeline
    - Cross-validation and standardized evaluation metrics
    - Persists trained artifacts with joblib
    - Generates model comparison leaderboard
    """
    return ml_service.create_and_enqueue_training_job(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        request=request,
        background_tasks=background_tasks,
    )


@router.get(
    "/datasets/{dataset_id}/train/inspect-target",
    response_model=MLTargetInspectionResponse,
    summary="Inspect target column and auto-detect task type",
)
def inspect_target(
    dataset_id: int,
    target_column: Annotated[str, Query(description="Target column name to inspect")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Analyzes a candidate target column to infer classification vs regression task."""
    return ml_service.inspect_target(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        target_column=target_column,
    )


@router.get(
    "/datasets/{dataset_id}/jobs",
    response_model=list[MLJobResponse],
    summary="List training jobs for a dataset",
)
def list_dataset_jobs(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Retrieves all past and active training jobs for a user dataset."""
    return ml_repository.list_jobs_by_dataset(
        db=db, dataset_id=dataset_id, user_id=current_user.id, limit=limit
    )


@router.get(
    "/datasets/{dataset_id}/models",
    response_model=list[MLModelLeaderboardItem],
    summary="List all trained models for a dataset",
)
def list_dataset_models(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    """Retrieves all trained model artifacts and performance leaderboards for a dataset."""
    return ml_repository.list_models_by_dataset(
        db=db, dataset_id=dataset_id, user_id=current_user.id, limit=limit
    )


# --- Global ML Jobs & Models Endpoints ---
@router.get(
    "/ml/jobs/{job_id}",
    response_model=MLJobResponse,
    summary="Get status and leaderboard of a training job",
)
def get_job(
    job_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Polls progress or retrieves results and leaderboard of an asynchronous training job."""
    job = ml_repository.get_job(db=db, job_id=job_id, user_id=current_user.id)
    if not job:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training job not found.")
    return job


@router.get(
    "/ml/models/{model_id}",
    response_model=MLModelDetailResponse,
    summary="Get details, metrics, and hyperparameters of a trained model",
)
def get_model_details(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieves comprehensive metrics, cross-validation scores, and feature schema of a model."""
    model = ml_repository.get_model(db=db, model_id=model_id, user_id=current_user.id)
    if not model:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found.")
    return model


@router.post(
    "/ml/models/{model_id}/predict",
    response_model=MLPredictResponse,
    summary="Predict on new input using a saved model pipeline",
)
def predict(
    model_id: int,
    request: MLPredictRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Executes inference against a persisted joblib model artifact.
    Validates feature inputs and returns predicted values and class probabilities.
    """
    return ml_service.predict(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
        inputs=request.inputs,
    )
