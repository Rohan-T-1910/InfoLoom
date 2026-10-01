from typing import Any, Optional
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import Session
from app.models.eda_report import EDAReport

class EDARepository:
    def get_by_id_and_user(self, db: Session, report_id: int, user_id: int) -> Optional[EDAReport]:
        return db.scalar(
            select(EDAReport).where(
                and_(
                    EDAReport.id == report_id,
                    EDAReport.user_id == user_id
                )
            )
        )

    def get_latest_cached(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        is_cleaned: bool,
        target_column: Optional[str] = None,
    ) -> Optional[EDAReport]:
        query = select(EDAReport).where(
            and_(
                EDAReport.dataset_id == dataset_id,
                EDAReport.user_id == user_id,
                EDAReport.is_cleaned == is_cleaned,
            )
        )
        if target_column is not None:
            query = query.where(EDAReport.target_column == target_column)

        return db.scalar(query.order_by(desc(EDAReport.created_at)).limit(1))

    def create(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        is_cleaned: bool,
        target_column: Optional[str],
        kpis: dict[str, Any],
        summary_statistics: dict[str, Any],
        correlation_matrix: dict[str, Any],
        distributions: dict[str, Any],
        feature_importance: Optional[dict[str, Any]],
    ) -> EDAReport:
        report = EDAReport(
            dataset_id=dataset_id,
            user_id=user_id,
            is_cleaned=is_cleaned,
            target_column=target_column,
            kpis=kpis,
            summary_statistics=summary_statistics,
            correlation_matrix=correlation_matrix,
            distributions=distributions,
            feature_importance=feature_importance,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    def invalidate_cache(self, db: Session, dataset_id: int) -> int:
        """Deletes cached reports for a dataset when updated or cleaned."""
        deleted_count = db.query(EDAReport).filter(EDAReport.dataset_id == dataset_id).delete()
        db.commit()
        return deleted_count

eda_repository = EDARepository()
