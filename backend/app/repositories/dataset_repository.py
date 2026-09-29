from typing import Any, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.dataset import Dataset

class DatasetRepository:
    def create(
        self,
        db: Session,
        user_id: int,
        filename: str,
        original_filename: str,
        file_path: str,
        file_size_bytes: int,
        row_count: Optional[int] = None,
        column_count: Optional[int] = None,
        columns_metadata: Optional[dict[str, Any]] = None,
    ) -> Dataset:
        dataset = Dataset(
            user_id=user_id,
            filename=filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size_bytes=file_size_bytes,
            row_count=row_count,
            column_count=column_count,
            columns_metadata=columns_metadata,
            status="ready",
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        return dataset

    def get_by_id_and_user(self, db: Session, dataset_id: int, user_id: int) -> Optional[Dataset]:
        """Fetch dataset ensuring strict per-user multi-tenant ownership."""
        stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
        return db.scalars(stmt).first()

    def list_by_user(
        self, db: Session, user_id: int, skip: int = 0, limit: int = 50
    ) -> tuple[list[Dataset], int]:
        """List datasets belonging to user with pagination and total count."""
        count_stmt = select(func.count()).select_from(Dataset).where(Dataset.user_id == user_id)
        total = db.scalar(count_stmt) or 0

        stmt = (
            select(Dataset)
            .where(Dataset.user_id == user_id)
            .order_by(Dataset.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(db.scalars(stmt).all())
        return items, total

    def delete(self, db: Session, dataset: Dataset) -> None:
        db.delete(dataset)
        db.commit()

dataset_repository = DatasetRepository()
