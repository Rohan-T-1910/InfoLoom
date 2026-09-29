from datetime import datetime
from typing import Any, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class CleaningReport(Base):
    __tablename__ = "cleaning_reports"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )
    dataset_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    validation_summary: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    cleaning_summary: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    cleaned_file_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="completed"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    dataset = relationship("Dataset", back_populates="cleaning_reports")
    user = relationship("User")
