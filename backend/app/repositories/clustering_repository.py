from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.clustering import ClusteringModel

class ClusteringRepository:
    """Repository for querying, persisting, and removing clustering models and results."""

    def create(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        name: str,
        k: int,
        feature_names: list[str],
        use_cleaned: bool,
        n_samples: int,
        inertia: float,
        silhouette_score: Optional[float],
        cluster_centers: dict[str, Any],
        cluster_profiles: list[dict[str, Any]],
        evaluation_metrics: Optional[dict[str, Any]],
        sample_assignments: Optional[list[dict[str, Any]]],
        artifact_path: Optional[str] = None,
        status: str = "completed",
    ) -> ClusteringModel:
        model = ClusteringModel(
            dataset_id=dataset_id,
            user_id=user_id,
            name=name,
            k=k,
            feature_names=feature_names,
            use_cleaned=use_cleaned,
            n_samples=n_samples,
            inertia=inertia,
            silhouette_score=silhouette_score,
            cluster_centers=cluster_centers,
            cluster_profiles=cluster_profiles,
            evaluation_metrics=evaluation_metrics,
            sample_assignments=sample_assignments,
            artifact_path=artifact_path,
            status=status,
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    def get_by_id_and_user(
        self, db: Session, model_id: int, user_id: int
    ) -> Optional[ClusteringModel]:
        stmt = select(ClusteringModel).where(
            ClusteringModel.id == model_id,
            ClusteringModel.user_id == user_id,
        )
        return db.scalars(stmt).first()

    def list_by_dataset(
        self, db: Session, dataset_id: int, user_id: int, limit: int = 50
    ) -> list[ClusteringModel]:
        stmt = (
            select(ClusteringModel)
            .where(
                ClusteringModel.dataset_id == dataset_id,
                ClusteringModel.user_id == user_id,
            )
            .order_by(ClusteringModel.created_at.desc())
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def delete(self, db: Session, model: ClusteringModel) -> None:
        db.delete(model)
        db.commit()

clustering_repository = ClusteringRepository()
