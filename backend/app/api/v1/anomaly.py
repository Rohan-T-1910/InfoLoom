from typing import Annotated, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.anomaly import (
    AnomalyEvaluationRequest,
    AnomalyEvaluationResponse,
    AnomalyFeaturesResponse,
    AnomalyModelResponse,
    AnomalyModelSummary,
    AnomalyRunRequest,
)
from app.services.anomaly_service import anomaly_service

router = APIRouter(tags=["Phase 7 - Anomaly Detection"])


@router.get(
    "/datasets/{id}/anomalies/features",
    response_model=AnomalyFeaturesResponse,
    summary="Inspect candidate numeric features for anomaly detection",
)
def get_anomaly_features(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    use_cleaned: bool = Query(True, description="Whether to inspect cleaned or raw data"),
):
    """Returns all numeric features for the dataset with statistics and recommendation flags."""
    return anomaly_service.get_numeric_features(
        db=db,
        dataset_id=id,
        user_id=current_user.id,
        use_cleaned=use_cleaned,
    )


@router.post(
    "/datasets/{id}/anomalies/evaluate",
    response_model=AnomalyEvaluationResponse,
    summary="Preview anomaly detection configuration and score distribution",
)
def evaluate_anomaly_config(
    id: int,
    request: AnomalyEvaluationRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Evaluates Isolation Forest contamination rate and generates score histogram and anomaly counts."""
    return anomaly_service.evaluate_anomaly_config(
        db=db,
        dataset_id=id,
        user_id=current_user.id,
        request=request,
    )


@router.post(
    "/datasets/{id}/anomalies/run",
    response_model=AnomalyModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Run Isolation Forest anomaly detection and persist results",
)
def run_anomaly_detection(
    id: int,
    request: AnomalyRunRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Trains Isolation Forest on selected features, flags anomalous rows with explanatory z-scores,
    generates 2D scatter coordinates, and persists model artifacts.
    """
    return anomaly_service.run_anomaly_detection(
        db=db,
        dataset_id=id,
        user_id=current_user.id,
        request=request,
    )


@router.get(
    "/datasets/{id}/anomalies/results",
    response_model=List[AnomalyModelSummary],
    summary="List past anomaly detection runs for a dataset",
)
def list_dataset_anomaly_models(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Returns summary list of anomaly detection runs executed on the specified dataset."""
    return anomaly_service.list_dataset_models(
        db=db,
        dataset_id=id,
        user_id=current_user.id,
    )


@router.get(
    "/anomalies/models/{model_id}",
    response_model=AnomalyModelResponse,
    summary="Retrieve detailed anomaly detection model and flagged records",
)
def get_anomaly_model(
    model_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Retrieves full details of an anomaly detection model run including anomalous rows and scatter plot data."""
    return anomaly_service.get_anomaly_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )


@router.delete(
    "/anomalies/models/{model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an anomaly detection model and artifact",
)
def delete_anomaly_model(
    model_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Permanently deletes a saved anomaly model and unlinks its serialized pipeline artifact."""
    anomaly_service.delete_anomaly_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )
    return None
