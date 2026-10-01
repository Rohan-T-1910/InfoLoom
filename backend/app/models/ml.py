from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class MLJob(Base):
    __tablename__ = "ml_jobs"

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
    task_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    target_column: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    feature_columns: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False
    )
    test_size: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.2
    )
    use_cleaned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending"
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        String(1000),
        nullable=True
    )
    leaderboard: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON,
        nullable=True
    )
    best_model_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    dataset = relationship("Dataset", back_populates="ml_jobs")
    user = relationship("User")
    models = relationship("MLModel", back_populates="job", cascade="all, delete-orphan", order_by="desc(MLModel.is_best)")


class MLModel(Base):
    __tablename__ = "ml_models"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )
    job_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ml_jobs.id", ondelete="CASCADE"),
        nullable=False,
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
        nullable=False
    )
    algorithm: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    task_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    target_column: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    feature_names: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False
    )
    target_classes: Mapped[Optional[list[Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    metrics: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    hyperparameters: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    artifact_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    is_best: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    job = relationship("MLJob", back_populates="models")
    dataset = relationship("Dataset", back_populates="ml_models")
    user = relationship("User")
