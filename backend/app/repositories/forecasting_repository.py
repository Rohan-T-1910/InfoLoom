from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.forecasting import ForecastModel

class ForecastingRepository:
    """Repository for querying, persisting, and deleting time series forecasting models."""

    def create(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        name: str,
        date_column: str,
        target_column: str,
        forecast_horizon: int,
        frequency: str,
        use_cleaned: bool,
        n_historical_points: int,
        metrics: dict[str, Any],
        model_parameters: dict[str, Any],
        historical_points: list[dict[str, Any]],
        validation_points: Optional[list[dict[str, Any]]],
        forecast_points: list[dict[str, Any]],
        artifact_path: Optional[str] = None,
        status: str = "completed",
    ) -> ForecastModel:
        model = ForecastModel(
            dataset_id=dataset_id,
            user_id=user_id,
            name=name,
            date_column=date_column,
            target_column=target_column,
            forecast_horizon=forecast_horizon,
            frequency=frequency,
            use_cleaned=use_cleaned,
            n_historical_points=n_historical_points,
            metrics=metrics,
            model_parameters=model_parameters,
            historical_points=historical_points,
            validation_points=validation_points,
            forecast_points=forecast_points,
            artifact_path=artifact_path,
            status=status,
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    def get_by_id_and_user(
        self, db: Session, model_id: int, user_id: int
    ) -> Optional[ForecastModel]:
        stmt = select(ForecastModel).where(
            ForecastModel.id == model_id,
            ForecastModel.user_id == user_id,
        )
        return db.scalars(stmt).first()

    def list_by_dataset(
        self, db: Session, dataset_id: int, user_id: int, limit: int = 50
    ) -> list[ForecastModel]:
        stmt = (
            select(ForecastModel)
            .where(
                ForecastModel.dataset_id == dataset_id,
                ForecastModel.user_id == user_id,
            )
            .order_by(ForecastModel.created_at.desc())
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def delete(self, db: Session, model: ForecastModel) -> None:
        db.delete(model)
        db.commit()

forecasting_repository = ForecastingRepository()
