from datetime import datetime
from typing import Any, List, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class ReportDocument(Base):
    """
    Stores history of generated PDF reports and exported prediction packages.
    """
    __tablename__ = "report_documents"

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
    report_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="comprehensive_pdf"  # comprehensive_pdf, ml_predictions_csv, forecast_csv, anomaly_csv
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    file_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    sections_included: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list
    )
    metadata_summary: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    dataset = relationship("Dataset", back_populates="report_documents")
