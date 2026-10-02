from datetime import datetime
from typing import Any, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class InsightReport(Base):
    """
    Stores structured, deterministic business insight reports generated
    from dataset analytics (EDA, Trends, Distributions, Forecasting, Anomaly, ML).
    """
    __tablename__ = "insight_reports"

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
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    insights: Mapped[List[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        default=list
    )
    categories: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list
    )
    kpi_summary: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict
    )
    is_cleaned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    llm_polished: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
    total_insights: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    # Relationships
    dataset = relationship("Dataset", back_populates="insight_reports")
