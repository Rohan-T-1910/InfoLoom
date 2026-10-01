from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.clustering import (
    ClusteringEvaluationRequest,
    ClusteringEvaluationResponse,
    ClusteringFeaturesResponse,
    ClusteringModelResponse,
    ClusteringModelSummary,
    ClusteringRunRequest,
)
from app.services.clustering_service import clustering_service

router = APIRouter(tags=["Clustering & Customer Segmentation"])


@router.get(
    "/datasets/{dataset_id}/clustering/features",
    response_model=ClusteringFeaturesResponse,
    summary="Get valid numeric features suitable for clustering",
)
def get_clustering_features(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    use_cleaned: Annotated[bool, Query(description="Analyze cleaned data if available")] = True,
):
    """Inspects a dataset and returns candidate numeric features along with distribution summaries and recommendations."""
    return clustering_service.get_clustering_features(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        use_cleaned=use_cleaned,
    )


@router.post(
    "/datasets/{dataset_id}/clustering/evaluate",
    response_model=ClusteringEvaluationResponse,
    summary="Evaluate K range using Elbow Method (Inertia) and Silhouette Scores",
)
def evaluate_clustering(
    dataset_id: int,
    request: ClusteringEvaluationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Computes inertia and silhouette scores across a candidate range of K to guide optimal cluster selection."""
    return clustering_service.evaluate_clustering(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        request=request,
    )


@router.post(
    "/datasets/{dataset_id}/clustering/run",
    response_model=ClusteringModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Execute K-Means clustering, profile customer segments, and persist model",
)
def run_clustering(
    dataset_id: int,
    request: ClusteringRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Executes K-Means clustering with standard scaling and imputation, generates cluster profiles and 2D assignments, and saves artifacts."""
    return clustering_service.run_clustering(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        request=request,
    )


@router.get(
    "/datasets/{dataset_id}/clustering/results",
    response_model=list[ClusteringModelSummary],
    summary="List all clustering models and runs for a dataset",
)
def list_dataset_clustering_models(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieves all past segmentation runs for the specified dataset."""
    return clustering_service.list_dataset_models(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
    )


@router.get(
    "/clustering/models/{model_id}",
    response_model=ClusteringModelResponse,
    summary="Get detailed clustering model results, profiles, and 2D visualization data",
)
def get_clustering_model(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieves full cluster metrics, segment profiles, centers, and 2D sample assignments."""
    return clustering_service.get_clustering_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )


@router.delete(
    "/clustering/models/{model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a clustering model and serialized artifact",
)
def delete_clustering_model(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Deletes a clustering run and frees on-disk artifact storage."""
    clustering_service.delete_clustering_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )
