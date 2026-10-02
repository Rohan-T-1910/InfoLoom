from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class ForecastModel(Base):
    __tablename__ = "forecast_models"

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
        default="ARIMA Time Series Forecast"
    )
    date_column: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    target_column: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    forecast_horizon: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    frequency: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="D"
    )
    use_cleaned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    n_historical_points: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    metrics: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    model_parameters: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    historical_points: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False
    )
    validation_points: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON,
        nullable=True
    )
    forecast_points: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False
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

    dataset = relationship("Dataset", back_populates="forecast_models")
    user = relationship("User")
