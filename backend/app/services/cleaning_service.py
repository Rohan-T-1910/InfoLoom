import os
from pathlib import Path
from typing import Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
import pandas as pd

from app.cleaning.pipeline import CleaningPipeline
from app.models.cleaning_report import CleaningReport
from app.models.dataset import Dataset
from app.repositories.cleaning_report_repository import cleaning_report_repository
from app.repositories.dataset_repository import dataset_repository
from app.repositories.eda_repository import eda_repository
from app.schemas.cleaning import CleaningConfig
from app.schemas.dataset import DatasetPreviewResponse
from app.services.validation_service import validation_service

class DataCleaningService:
    """
    Coordinates data validation, executes modular cleaning pipelines,
    and manages persisted cleaning reports with strict multi-tenancy.
    """

    def validate_dataset(self, db: Session, dataset_id: int, user_id: int) -> dict[str, Any]:
        """Runs the validation engine on a user-owned dataset without modifying files."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found."
            )

        if not os.path.exists(dataset.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset source file is missing from storage."
            )

        df = validation_service.read_dataset_df(dataset.file_path)
        report = validation_service.validate_dataframe(df)
        report["dataset_id"] = dataset.id
        return report

    def clean_dataset(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        config: Optional[CleaningConfig] = None,
    ) -> CleaningReport:
        """
        Runs validation and cleaning pipeline on dataset with provided strategies,
        saves cleaned CSV artifact, updates dataset status, and persists cleaning report.
        """
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found."
            )

        if not os.path.exists(dataset.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset source file is missing from storage."
            )

        if config is None:
            config = CleaningConfig()

        # 1. Read source data
        raw_df = validation_service.read_dataset_df(dataset.file_path)

        # 2. Pre-cleaning validation profiling
        validation_summary = validation_service.validate_dataframe(raw_df)

        # 3. Construct and run modular cleaning pipeline
        pipeline = CleaningPipeline.create_default_pipeline(
            dedup_keep=config.dedup_keep,
            numeric_impute_strategy=config.numeric_impute_strategy,
            categorical_impute_strategy=config.categorical_impute_strategy,
            numeric_fill_value=config.numeric_fill_value,
            categorical_fill_value=config.categorical_fill_value,
            drop_column_threshold=config.drop_column_threshold,
            outlier_strategy=config.outlier_strategy,
            outlier_method=config.outlier_method,
        )

        cleaned_df, cleaning_summary = pipeline.run(raw_df)

        # 4. Save cleaned CSV to disk
        source_path = Path(dataset.file_path)
        cleaned_filename = f"cleaned_{source_path.name}"
        cleaned_path = source_path.parent / cleaned_filename

        cleaned_df.to_csv(cleaned_path, index=False, encoding="utf-8")

        # 5. Update Dataset state
        dataset.cleaned_file_path = str(cleaned_path)
        dataset.has_cleaned = True
        db.commit()
        db.refresh(dataset)

        # 6. Persist CleaningReport
        cleaning_report = cleaning_report_repository.create(
            db=db,
            dataset_id=dataset.id,
            user_id=user_id,
            validation_summary=validation_summary,
            cleaning_summary=cleaning_summary,
            cleaned_file_path=str(cleaned_path),
            status="completed",
        )

        # 7. Invalidate any existing EDA cache for this dataset
        eda_repository.invalidate_cache(db=db, dataset_id=dataset.id)

        return cleaning_report

    def get_latest_report(self, db: Session, dataset_id: int, user_id: int) -> CleaningReport:
        """Retrieves the latest persisted cleaning report for a dataset."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found."
            )

        report = cleaning_report_repository.get_latest_by_dataset_and_user(
            db, dataset_id=dataset_id, user_id=user_id
        )
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No cleaning report found for this dataset."
            )
        return report

    def get_cleaned_preview(
        self, db: Session, dataset_id: int, user_id: int, limit: int = 10
    ) -> DatasetPreviewResponse:
        """Previews rows from the cleaned dataset file."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found."
            )

        if not dataset.has_cleaned or not dataset.cleaned_file_path or not os.path.exists(dataset.cleaned_file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cleaned dataset not available. Please run data cleaning first."
            )

        df = pd.read_csv(dataset.cleaned_file_path, nrows=limit)
        columns = list(df.columns)
        # Convert NaN values to None for clean JSON serialization
        sample_rows = df.where(pd.notnull(df), None).to_dict(orient="records")

        # Get total cleaned rows
        cleaned_total_rows = sum(1 for _ in open(dataset.cleaned_file_path, "r", encoding="utf-8")) - 1

        return DatasetPreviewResponse(
            id=dataset.id,
            original_filename=f"cleaned_{dataset.original_filename}",
            row_count=cleaned_total_rows,
            column_count=len(columns),
            columns=columns,
            sample_rows=sample_rows,
        )

cleaning_service = DataCleaningService()
