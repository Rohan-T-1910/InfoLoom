from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class EDAReport(Base):
    __tablename__ = "eda_reports"

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
    is_cleaned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
    target_column: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    kpis: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    summary_statistics: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    correlation_matrix: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    distributions: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    feature_importance: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    dataset = relationship("Dataset", back_populates="eda_reports")
    user = relationship("User")
