from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories.dataset_repository import dataset_repository
from app.repositories.insight_repository import insight_repository
from app.schemas.insight import (
    InsightGenerateRequest,
    InsightReportResponse,
    InsightSummaryResponse,
)
from app.services.insights_service import insights_service

router = APIRouter(tags=["Phase 8 - Business Insights"])

@router.get(
    "/datasets/{id}/insights",
    response_model=InsightReportResponse,
    summary="Get or generate business insights for a dataset",
)
def get_dataset_insights(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    refresh: bool = Query(False, description="Whether to recompute fresh insights"),
    include_llm: bool = Query(False, description="Whether to optionally apply LLM phrasing layer"),
    category: Optional[str] = Query(None, description="Filter insights by category"),
    min_severity: Optional[str] = Query(None, description="Filter insights by minimum severity (info, positive, warning, critical)"),
):
    """
    Retrieves latest cached business insights for the dataset, or deterministically
    generates and saves a fresh report if none exists or refresh=True.
    """
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    return insights_service.get_or_generate_insights(
        db=db,
        dataset=dataset,
        user_id=current_user.id,
        refresh=refresh,
        include_llm=include_llm,
        category=category,
        min_severity=min_severity,
    )

@router.post(
    "/datasets/{id}/insights/generate",
    response_model=InsightReportResponse,
    summary="Generate a fresh business insights report",
)
def generate_dataset_insights(
    id: int,
    request: InsightGenerateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Explicitly executes deterministic rule evaluation across analytical outputs
    and generates a new persisted insight report.
    """
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    return insights_service.generate_insights(
        db=db,
        dataset=dataset,
        user_id=current_user.id,
        request=request,
    )

@router.get(
    "/datasets/{id}/insights/summary",
    response_model=InsightSummaryResponse,
    summary="Retrieve quick KPI summary of latest business insights",
)
def get_insights_summary(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Returns compact summary metrics and top insights for dashboard cards."""
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    return insights_service.get_summary(db=db, dataset_id=id, user_id=current_user.id)

@router.delete(
    "/datasets/{id}/insights",
    status_code=status.HTTP_200_OK,
    summary="Delete all insight reports for a dataset",
)
def delete_dataset_insights(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Deletes cached insight reports for this dataset."""
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    deleted_count = insight_repository.delete_by_dataset_and_user(
        db=db, dataset_id=id, user_id=current_user.id
    )
    return {
        "detail": f"Successfully deleted {deleted_count} insight report(s)",
        "deleted_count": deleted_count,
    }
