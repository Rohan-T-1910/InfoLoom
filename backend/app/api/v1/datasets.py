from typing import Annotated, Optional
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.cleaning import (
    CleaningConfig,
    CleaningReportResponse,
    ValidationReportResponse,
)
from app.schemas.dataset import (
    DatasetDetailResponse,
    DatasetListResponse,
    DatasetPreviewResponse,
)
from app.services.cleaning_service import cleaning_service
from app.services.dataset_service import dataset_service

router = APIRouter(prefix="/datasets", tags=["Datasets"])

@router.post(
    "/upload",
    response_model=DatasetDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a CSV dataset"
)
async def upload_dataset(
    file: Annotated[UploadFile, File(description="CSV file to upload")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Upload and validate a CSV dataset file.
    - Validates file type and size.
    - Streams directly to disk to prevent RAM exhaustion.
    - Inspects column headers, row counts, and types.
    - Associates strictly with the authenticated user.
    """
    return await dataset_service.upload_dataset(db=db, file=file, user_id=current_user.id)

@router.get(
    "",
    response_model=DatasetListResponse,
    summary="List all datasets for the authenticated user"
)
def list_datasets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    skip: Annotated[int, Query(ge=0, description="Number of items to skip")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Max items to return")] = 50,
):
    """Retrieve all datasets uploaded by the current user with pagination."""
    items, total = dataset_service.list_datasets(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return DatasetListResponse(items=items, total=total)

@router.get(
    "/{dataset_id}",
    response_model=DatasetDetailResponse,
    summary="Get dataset details and metadata"
)
def get_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get metadata and schema information for a specific dataset owned by the user."""
    return dataset_service.get_dataset(db=db, dataset_id=dataset_id, user_id=current_user.id)

@router.get(
    "/{dataset_id}/preview",
    response_model=DatasetPreviewResponse,
    summary="Preview sample rows from the raw dataset"
)
def preview_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100, description="Number of preview rows")] = 10,
):
    """Retrieve sample rows and header columns from the stored CSV."""
    return dataset_service.get_preview(db=db, dataset_id=dataset_id, user_id=current_user.id, limit=limit)

@router.delete(
    "/{dataset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a dataset"
)
def delete_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Permanently delete a dataset and its stored CSV file."""
    dataset_service.delete_dataset(db=db, dataset_id=dataset_id, user_id=current_user.id)

@router.post(
    "/{dataset_id}/validate",
    response_model=ValidationReportResponse,
    summary="Validate dataset and generate statistical quality report"
)
def validate_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Runs comprehensive data validation:
    - Schema & fine-grained data type detection
    - Descriptive statistics (mean, median, std, percentiles)
    - Missing-value analysis and severity categorization
    - Duplicate detection count and percentage
    - Outlier detection via IQR and Z-Score algorithms
    """
    return cleaning_service.validate_dataset(db=db, dataset_id=dataset_id, user_id=current_user.id)

@router.post(
    "/{dataset_id}/clean",
    response_model=CleaningReportResponse,
    summary="Run automatic cleaning pipeline on dataset"
)
def clean_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    config: Optional[CleaningConfig] = None,
):
    """
    Executes swappable cleaning pipeline:
    - Deduplication
    - Type coercion (formats, whitespace, booleans, dates)
    - Missing value imputation (median/mean/mode/constant/drop)
    - Outlier handling (clipping or removal)
    - Persists audit report to database and saves cleaned CSV artifact
    """
    return cleaning_service.clean_dataset(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        config=config,
    )

@router.get(
    "/{dataset_id}/cleaning-report",
    response_model=CleaningReportResponse,
    summary="Get latest persisted cleaning report for dataset"
)
def get_cleaning_report(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Fetch the latest persisted cleaning report and transformation summary."""
    return cleaning_service.get_latest_report(db=db, dataset_id=dataset_id, user_id=current_user.id)

@router.get(
    "/{dataset_id}/cleaned-preview",
    response_model=DatasetPreviewResponse,
    summary="Preview sample rows from the cleaned dataset"
)
def preview_cleaned_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100, description="Number of preview rows")] = 10,
):
    """Retrieve sample rows from the cleaned CSV dataset."""
    return cleaning_service.get_cleaned_preview(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        limit=limit,
    )

