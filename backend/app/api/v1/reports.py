import io
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories.dataset_repository import dataset_repository
from app.repositories.report_repository import report_repository
from app.schemas.report import (
    ReportReadinessResponse,
    ReportDocumentResponse,
    CSVExportPreviewResponse,
)
from app.services.report_service import report_service

router = APIRouter(tags=["Phase 9 - Reports & Export"])


@router.get(
    "/datasets/{id}/reports/readiness",
    response_model=ReportReadinessResponse,
    summary="Get multi-phase analytical readiness status for a dataset report",
)
def get_report_readiness(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Inspects which analytical phases (1-8) have executed and are ready
    to be included in the executive PDF report.
    """
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    return report_service.get_report_readiness(
        db=db,
        dataset=dataset,
        user_id=current_user.id,
    )


@router.get(
    "/datasets/{id}/reports/pdf",
    summary="Generate and download executive PDF report for a dataset",
)
def download_pdf_report(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Generates a comprehensive executive PDF report compiling all completed
    analytical phases (cleaning, EDA, ML benchmarks, clustering, forecasting,
    anomalies, and business insights). Gracefully indicates missing phases.
    """
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    try:
        file_name, pdf_bytes = report_service.generate_pdf_report(
            db=db,
            dataset=dataset,
            user_id=current_user.id,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation encountered an error: {str(err)}",
        )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            "Content-Length": str(len(pdf_bytes)),
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/datasets/{id}/reports/export/preview",
    response_model=CSVExportPreviewResponse,
    summary="Preview predictions CSV export columns and initial rows",
)
def preview_predictions_csv(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    export_type: str = Query("ml", description="Type of predictions: 'ml', 'forecast', or 'anomaly'"),
    model_id: Optional[int] = Query(None, description="Specific model ID (optional)"),
):
    """
    Returns column headers, schema, and first 5 rows of the exported prediction dataset.
    """
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    if export_type.lower() not in ("ml", "forecast", "anomaly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid export_type '{export_type}'. Must be 'ml', 'forecast', or 'anomaly'.",
        )

    try:
        return report_service.preview_predictions_csv(
            db=db,
            dataset=dataset,
            user_id=current_user.id,
            export_type=export_type,
            model_id=model_id,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(val_err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate prediction preview: {str(err)}",
        )


@router.get(
    "/datasets/{id}/reports/export/predictions",
    summary="Export predictions, forecasts, or anomaly diagnostics as CSV",
)
def export_predictions_csv(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    export_type: str = Query("ml", description="Type of predictions: 'ml', 'forecast', or 'anomaly'"),
    model_id: Optional[int] = Query(None, description="Specific model ID (optional)"),
):
    """
    Streams a CSV file containing inputs, model predictions, actuals, and residuals.
    """
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    if export_type.lower() not in ("ml", "forecast", "anomaly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid export_type '{export_type}'. Must be 'ml', 'forecast', or 'anomaly'.",
        )

    try:
        file_name, csv_bytes = report_service.export_predictions_csv(
            db=db,
            dataset=dataset,
            user_id=current_user.id,
            export_type=export_type,
            model_id=model_id,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(val_err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export prediction dataset: {str(err)}",
        )

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            "Content-Length": str(len(csv_bytes)),
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/datasets/{id}/reports/history",
    response_model=List[ReportDocumentResponse],
    summary="Get history of generated PDF reports and CSV exports for a dataset",
)
def get_report_history(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(20, ge=1, le=100),
):
    """
    Returns audit trail of past generated PDF reports and CSV exports.
    """
    dataset = dataset_repository.get_by_id_and_user(db, dataset_id=id, user_id=current_user.id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access denied",
        )

    return report_repository.list_by_dataset_and_user(
        db=db,
        dataset_id=id,
        user_id=current_user.id,
        limit=limit,
    )
