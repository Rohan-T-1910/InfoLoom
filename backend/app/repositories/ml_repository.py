from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session
from app.models.ml import MLJob, MLModel

class MLRepository:
    # --- Jobs ---
    def create_job(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        task_type: str,
        target_column: str,
        feature_columns: list[str],
        test_size: float = 0.2,
        use_cleaned: bool = True,
        status: str = "pending",
    ) -> MLJob:
        job = MLJob(
            dataset_id=dataset_id,
            user_id=user_id,
            task_type=task_type,
            target_column=target_column,
            feature_columns=feature_columns,
            test_size=test_size,
            use_cleaned=use_cleaned,
            status=status,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def get_job(self, db: Session, job_id: int, user_id: int) -> Optional[MLJob]:
        return db.scalar(
            select(MLJob).where(
                and_(
                    MLJob.id == job_id,
                    MLJob.user_id == user_id,
                )
            )
        )

    def list_jobs_by_dataset(
        self, db: Session, dataset_id: int, user_id: int, limit: int = 20
    ) -> list[MLJob]:
        return list(
            db.scalars(
                select(MLJob)
                .where(and_(MLJob.dataset_id == dataset_id, MLJob.user_id == user_id))
                .order_by(desc(MLJob.created_at))
                .limit(limit)
            ).all()
        )

    def list_jobs_by_user(
        self, db: Session, user_id: int, skip: int = 0, limit: int = 50
    ) -> list[MLJob]:
        return list(
            db.scalars(
                select(MLJob)
                .where(MLJob.user_id == user_id)
                .order_by(desc(MLJob.created_at))
                .offset(skip)
                .limit(limit)
            ).all()
        )

    def update_job_status(self, db: Session, job_id: int, status: str) -> Optional[MLJob]:
        job = db.scalar(select(MLJob).where(MLJob.id == job_id))
        if job:
            job.status = status
            db.commit()
            db.refresh(job)
        return job

    def update_job_completed(
        self,
        db: Session,
        job_id: int,
        leaderboard: list[dict[str, Any]],
        best_model_id: Optional[int],
    ) -> Optional[MLJob]:
        job = db.scalar(select(MLJob).where(MLJob.id == job_id))
        if job:
            job.status = "completed"
            job.leaderboard = leaderboard
            job.best_model_id = best_model_id
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(job)
        return job

    def update_job_failed(
        self, db: Session, job_id: int, error_message: str
    ) -> Optional[MLJob]:
        job = db.scalar(select(MLJob).where(MLJob.id == job_id))
        if job:
            job.status = "failed"
            job.error_message = error_message[:1000]
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(job)
        return job

    # --- Models ---
    def create_model(
        self,
        db: Session,
        job_id: int,
        dataset_id: int,
        user_id: int,
        name: str,
        algorithm: str,
        task_type: str,
        target_column: str,
        feature_names: list[str],
        target_classes: Optional[list[Any]],
        metrics: dict[str, Any],
        hyperparameters: dict[str, Any],
        artifact_path: str,
        is_best: bool = False,
    ) -> MLModel:
        model = MLModel(
            job_id=job_id,
            dataset_id=dataset_id,
            user_id=user_id,
            name=name,
            algorithm=algorithm,
            task_type=task_type,
            target_column=target_column,
            feature_names=feature_names,
            target_classes=target_classes,
            metrics=metrics,
            hyperparameters=hyperparameters,
            artifact_path=artifact_path,
            is_best=is_best,
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    def get_model(self, db: Session, model_id: int, user_id: int) -> Optional[MLModel]:
        return db.scalar(
            select(MLModel).where(
                and_(
                    MLModel.id == model_id,
                    MLModel.user_id == user_id,
                )
            )
        )

    def list_models_by_dataset(
        self, db: Session, dataset_id: int, user_id: int, limit: int = 50
    ) -> list[MLModel]:
        return list(
            db.scalars(
                select(MLModel)
                .where(and_(MLModel.dataset_id == dataset_id, MLModel.user_id == user_id))
                .order_by(desc(MLModel.created_at))
                .limit(limit)
            ).all()
        )

    def list_models_by_job(self, db: Session, job_id: int) -> list[MLModel]:
        return list(
            db.scalars(
                select(MLModel)
                .where(MLModel.job_id == job_id)
                .order_by(desc(MLModel.is_best))
            ).all()
        )

ml_repository = MLRepository()
