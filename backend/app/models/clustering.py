from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class ClusteringModel(Base):
    __tablename__ = "clustering_models"

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
        default="K-Means Clustering"
    )
    k: Mapped[int] = mapped_column(
        Integer,
        nullable=False
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
    inertia: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    silhouette_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    cluster_centers: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    cluster_profiles: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False
    )
    evaluation_metrics: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    sample_assignments: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
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

    dataset = relationship("Dataset", back_populates="clustering_models")
    user = relationship("User")
