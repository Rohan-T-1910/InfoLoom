from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class AnomalyModel(Base):
    __tablename__ = "anomaly_models"

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
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Isolation Forest Anomaly Detection"
    )
    contamination: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.05
    )
    n_estimators: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=100
    )
    feature_names: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False
    )
    use_cleaned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    n_samples: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    n_anomalies: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    anomaly_percentage: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    threshold_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    score_min: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    score_max: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    score_mean: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    summary_stats: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    anomalous_rows: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON,
        nullable=True
    )
    distribution_buckets: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON,
        nullable=True
    )
    scatter_points: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON,
        nullable=True
    )
    artifact_path: Mapped[Optional[str]] = mapped_column(
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

    dataset = relationship("Dataset", back_populates="anomaly_models")
    user = relationship("User")
