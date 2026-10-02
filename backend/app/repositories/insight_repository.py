from typing import Any, List, Optional
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.models.insight import InsightReport

class InsightRepository:
    """Repository for querying, persisting, and removing business insight reports."""

    def create(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        title: str,
        insights: List[dict[str, Any]],
        categories: List[str],
        kpi_summary: dict[str, Any],
        is_cleaned: bool = True,
        llm_polished: bool = False,
        summary: Optional[str] = None,
    ) -> InsightReport:
        report = InsightReport(
            dataset_id=dataset_id,
            user_id=user_id,
            title=title,
            summary=summary,
            insights=insights,
            categories=categories,
            kpi_summary=kpi_summary,
            is_cleaned=is_cleaned,
            llm_polished=llm_polished,
            total_insights=len(insights),
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    def get_latest_by_dataset_and_user(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> Optional[InsightReport]:
        stmt = (
            select(InsightReport)
            .where(InsightReport.dataset_id == dataset_id, InsightReport.user_id == user_id)
            .order_by(desc(InsightReport.created_at))
            .limit(1)
        )
        return db.execute(stmt).scalars().first()

    def get_by_id_and_user(
        self,
        db: Session,
        report_id: int,
        user_id: int,
    ) -> Optional[InsightReport]:
        stmt = select(InsightReport).where(
            InsightReport.id == report_id,
            InsightReport.user_id == user_id,
        )
        return db.execute(stmt).scalars().first()

    def list_by_dataset_and_user(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        limit: int = 10,
    ) -> List[InsightReport]:
        stmt = (
            select(InsightReport)
            .where(InsightReport.dataset_id == dataset_id, InsightReport.user_id == user_id)
            .order_by(desc(InsightReport.created_at))
            .limit(limit)
        )
        return list(db.execute(stmt).scalars().all())

    def delete_by_dataset_and_user(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> int:
        stmt = select(InsightReport).where(
            InsightReport.dataset_id == dataset_id,
            InsightReport.user_id == user_id,
        )
        reports = db.execute(stmt).scalars().all()
        count = len(reports)
        for r in reports:
            db.delete(r)
        db.commit()
        return count

    def delete_by_id_and_user(
        self,
        db: Session,
        report_id: int,
        user_id: int,
    ) -> bool:
        report = self.get_by_id_and_user(db, report_id=report_id, user_id=user_id)
        if not report:
            return False
        db.delete(report)
        db.commit()
        return True

insight_repository = InsightRepository()
