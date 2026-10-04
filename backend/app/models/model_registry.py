from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class RegisteredModel(Base):
    __tablename__ = "registered_models"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    dataset_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    source_model_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("ml_models.id", ondelete="SET NULL"),
        nullable=True,
        index=True
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
    training_parameters: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    artifact_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    artifact_size_bytes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ready"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True
    )
    activated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
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

    user = relationship("User")
    dataset = relationship("Dataset", back_populates="registered_models")
    source_model = relationship("MLModel")

    __table_args__ = (
        UniqueConstraint("user_id", "name", "version", name="uq_user_model_version"),
        Index("ix_registered_models_active", "user_id", "name", "is_active"),
        Index("ix_registered_models_dataset", "user_id", "dataset_id"),
    )
