from typing import Any, List, Optional
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.models.report import ReportDocument

class ReportRepository:
    """Repository for querying, persisting, and removing report documents and export history."""

    def create(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        title: str,
        report_type: str,
        file_name: str,
        file_size_bytes: int,
        sections_included: List[str],
        metadata_summary: dict[str, Any],
        file_path: Optional[str] = None,
    ) -> ReportDocument:
        doc = ReportDocument(
            dataset_id=dataset_id,
            user_id=user_id,
            title=title,
            report_type=report_type,
            file_name=file_name,
            file_path=file_path,
            file_size_bytes=file_size_bytes,
            sections_included=sections_included,
            metadata_summary=metadata_summary,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    def get_by_id_and_user(
        self,
        db: Session,
        doc_id: int,
        user_id: int,
    ) -> Optional[ReportDocument]:
        stmt = select(ReportDocument).where(
            ReportDocument.id == doc_id,
            ReportDocument.user_id == user_id,
        )
        return db.execute(stmt).scalars().first()

    def list_by_dataset_and_user(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        limit: int = 20,
    ) -> List[ReportDocument]:
        stmt = (
            select(ReportDocument)
            .where(ReportDocument.dataset_id == dataset_id, ReportDocument.user_id == user_id)
            .order_by(desc(ReportDocument.created_at))
            .limit(limit)
        )
        return list(db.execute(stmt).scalars().all())

    # Convenience alias
    get_by_dataset_and_user = list_by_dataset_and_user

    def delete_by_id_and_user(
        self,
        db: Session,
        doc_id: int,
        user_id: int,
    ) -> bool:
        doc = self.get_by_id_and_user(db, doc_id=doc_id, user_id=user_id)
        if not doc:
            return False
        db.delete(doc)
        db.commit()
        return True

report_repository = ReportRepository()
