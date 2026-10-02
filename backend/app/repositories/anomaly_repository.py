from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.anomaly import AnomalyModel

class AnomalyRepository:
    """Repository for querying, persisting, and removing anomaly detection models and results."""

    def create(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        name: str,
        contamination: float,
        n_estimators: int,
        feature_names: list[str],
        use_cleaned: bool,
        n_samples: int,
        n_anomalies: int,
        anomaly_percentage: float,
        threshold_score: float,
        score_min: float,
        score_max: float,
        score_mean: float,
        summary_stats: Optional[dict[str, Any]] = None,
        anomalous_rows: Optional[list[dict[str, Any]]] = None,
        distribution_buckets: Optional[list[dict[str, Any]]] = None,
        scatter_points: Optional[list[dict[str, Any]]] = None,
        artifact_path: Optional[str] = None,
        status: str = "completed",
    ) -> AnomalyModel:
        model = AnomalyModel(
            dataset_id=dataset_id,
            user_id=user_id,
            name=name,
            contamination=contamination,
            n_estimators=n_estimators,
            feature_names=feature_names,
            use_cleaned=use_cleaned,
            n_samples=n_samples,
            n_anomalies=n_anomalies,
            anomaly_percentage=anomaly_percentage,
            threshold_score=threshold_score,
            score_min=score_min,
            score_max=score_max,
            score_mean=score_mean,
            summary_stats=summary_stats,
            anomalous_rows=anomalous_rows,
            distribution_buckets=distribution_buckets,
            scatter_points=scatter_points,
            artifact_path=artifact_path,
            status=status,
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    def get_by_id_and_user(
        self, db: Session, model_id: int, user_id: int
    ) -> Optional[AnomalyModel]:
        stmt = select(AnomalyModel).where(
            AnomalyModel.id == model_id,
            AnomalyModel.user_id == user_id,
        )
        return db.scalars(stmt).first()

    def list_by_dataset(
        self, db: Session, dataset_id: int, user_id: int, limit: int = 50
    ) -> list[AnomalyModel]:
        stmt = (
            select(AnomalyModel)
            .where(
                AnomalyModel.dataset_id == dataset_id,
                AnomalyModel.user_id == user_id,
            )
            .order_by(AnomalyModel.created_at.desc())
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def delete(self, db: Session, model: AnomalyModel) -> None:
        db.delete(model)
        db.commit()

anomaly_repository = AnomalyRepository()
