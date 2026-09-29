from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.cleaning_report import CleaningReport

class CleaningReportRepository:
    def create(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        validation_summary: dict[str, Any],
        cleaning_summary: dict[str, Any],
        cleaned_file_path: Optional[str] = None,
        status: str = "completed",
    ) -> CleaningReport:
        report = CleaningReport(
            dataset_id=dataset_id,
            user_id=user_id,
            validation_summary=validation_summary,
            cleaning_summary=cleaning_summary,
            cleaned_file_path=cleaned_file_path,
            status=status,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    def get_by_id_and_user(self, db: Session, report_id: int, user_id: int) -> Optional[CleaningReport]:
        stmt = select(CleaningReport).where(
            CleaningReport.id == report_id,
            CleaningReport.user_id == user_id
        )
        return db.scalars(stmt).first()

    def get_latest_by_dataset_and_user(
        self, db: Session, dataset_id: int, user_id: int
    ) -> Optional[CleaningReport]:
        stmt = (
            select(CleaningReport)
            .where(CleaningReport.dataset_id == dataset_id, CleaningReport.user_id == user_id)
            .order_by(CleaningReport.created_at.desc())
        )
        return db.scalars(stmt).first()

    def list_by_dataset_and_user(
        self, db: Session, dataset_id: int, user_id: int
    ) -> list[CleaningReport]:
        stmt = (
            select(CleaningReport)
            .where(CleaningReport.dataset_id == dataset_id, CleaningReport.user_id == user_id)
            .order_by(CleaningReport.created_at.desc())
        )
        return list(db.scalars(stmt).all())

cleaning_report_repository = CleaningReportRepository()
