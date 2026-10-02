from datetime import datetime
from typing import Any, Optional
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False
    )
    row_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    column_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    columns_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ready"
    )
    cleaned_file_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    has_cleaned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    owner = relationship("User", back_populates="datasets")
    cleaning_reports = relationship("CleaningReport", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(CleaningReport.created_at)")
    eda_reports = relationship("EDAReport", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(EDAReport.created_at)")
    ml_jobs = relationship("MLJob", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(MLJob.created_at)")
    ml_models = relationship("MLModel", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(MLModel.created_at)")
    clustering_models = relationship("ClusteringModel", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(ClusteringModel.created_at)")
    forecast_models = relationship("ForecastModel", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(ForecastModel.created_at)")
    anomaly_models = relationship("AnomalyModel", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(AnomalyModel.created_at)")
    insight_reports = relationship("InsightReport", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(InsightReport.created_at)")
    report_documents = relationship("ReportDocument", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(ReportDocument.created_at)")
    registered_models = relationship("RegisteredModel", back_populates="dataset", cascade="all, delete-orphan", order_by="desc(RegisteredModel.created_at)")


