from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload
from app.models.model_registry import RegisteredModel

class ModelRegistryRepository:
    def get(
        self, db: Session, model_id: int, user_id: Optional[int] = None
    ) -> Optional[RegisteredModel]:
        query = db.query(RegisteredModel).options(joinedload(RegisteredModel.dataset)).filter(RegisteredModel.id == model_id)
        if user_id is not None:
            query = query.filter(RegisteredModel.user_id == user_id)
        return query.first()

    def get_by_name_and_version(
        self, db: Session, user_id: int, name: str, version: int
    ) -> Optional[RegisteredModel]:
        return (
            db.query(RegisteredModel)
            .options(joinedload(RegisteredModel.dataset))
            .filter(
                RegisteredModel.user_id == user_id,
                RegisteredModel.name == name,
                RegisteredModel.version == version,
            )
            .first()
        )

    def get_next_version(self, db: Session, user_id: int, name: str) -> int:
        max_v = (
            db.query(func.max(RegisteredModel.version))
            .filter(
                RegisteredModel.user_id == user_id,
                RegisteredModel.name == name,
            )
            .scalar()
        )
        return (max_v or 0) + 1

    def get_active_model(
        self,
        db: Session,
        user_id: int,
        name: Optional[str] = None,
        dataset_id: Optional[int] = None,
    ) -> Optional[RegisteredModel]:
        query = (
            db.query(RegisteredModel)
            .options(joinedload(RegisteredModel.dataset))
            .filter(
                RegisteredModel.user_id == user_id,
                RegisteredModel.is_active == True,  # noqa: E712
            )
        )
        if name:
            query = query.filter(RegisteredModel.name == name)
        if dataset_id is not None:
            query = query.filter(RegisteredModel.dataset_id == dataset_id)
        return query.order_by(desc(RegisteredModel.activated_at), desc(RegisteredModel.created_at)).first()

    def get_previous_version(
        self,
        db: Session,
        user_id: int,
        name: str,
        current_version: int,
    ) -> Optional[RegisteredModel]:
        return (
            db.query(RegisteredModel)
            .options(joinedload(RegisteredModel.dataset))
            .filter(
                RegisteredModel.user_id == user_id,
                RegisteredModel.name == name,
                RegisteredModel.version < current_version,
            )
            .order_by(desc(RegisteredModel.version))
            .first()
        )

    def list_models(
        self,
        db: Session,
        user_id: int,
        dataset_id: Optional[int] = None,
        name: Optional[str] = None,
        task_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[RegisteredModel]:
        query = (
            db.query(RegisteredModel)
            .options(joinedload(RegisteredModel.dataset))
            .filter(RegisteredModel.user_id == user_id)
        )
        if dataset_id is not None:
            query = query.filter(RegisteredModel.dataset_id == dataset_id)
        if name:
            query = query.filter(RegisteredModel.name == name)
        if task_type:
            query = query.filter(RegisteredModel.task_type == task_type)
        if is_active is not None:
            query = query.filter(RegisteredModel.is_active == is_active)

        return (
            query.order_by(
                RegisteredModel.name.asc(),
                desc(RegisteredModel.version),
            )
            .offset(offset)
            .limit(limit)
            .all()
        )

    def count_models(
        self,
        db: Session,
        user_id: int,
        dataset_id: Optional[int] = None,
        name: Optional[str] = None,
        task_type: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        query = db.query(func.count(RegisteredModel.id)).filter(RegisteredModel.user_id == user_id)
        if dataset_id is not None:
            query = query.filter(RegisteredModel.dataset_id == dataset_id)
        if name:
            query = query.filter(RegisteredModel.name == name)
        if task_type:
            query = query.filter(RegisteredModel.task_type == task_type)
        if is_active is not None:
            query = query.filter(RegisteredModel.is_active == is_active)
        return query.scalar() or 0

    def deactivate_family(self, db: Session, user_id: int, name: str) -> None:
        db.query(RegisteredModel).filter(
            RegisteredModel.user_id == user_id,
            RegisteredModel.name == name,
            RegisteredModel.is_active == True,  # noqa: E712
        ).update({"is_active": False}, synchronize_session="fetch")

    def activate_model(self, db: Session, model: RegisteredModel) -> RegisteredModel:
        self.deactivate_family(db, model.user_id, model.name)
        model.is_active = True
        model.activated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(model)
        return model

    def create(
        self,
        db: Session,
        name: str,
        version: int,
        user_id: int,
        dataset_id: int,
        algorithm: str,
        task_type: str,
        target_column: str,
        feature_names: list[str],
        metrics: dict[str, Any],
        training_parameters: dict[str, Any],
        artifact_path: str,
        source_model_id: Optional[int] = None,
        target_classes: Optional[list[Any]] = None,
        description: Optional[str] = None,
        artifact_size_bytes: Optional[int] = None,
        is_active: bool = False,
    ) -> RegisteredModel:
        if is_active:
            self.deactivate_family(db, user_id, name)

        now = datetime.now(timezone.utc)
        model = RegisteredModel(
            name=name,
            version=version,
            description=description,
            user_id=user_id,
            dataset_id=dataset_id,
            source_model_id=source_model_id,
            algorithm=algorithm,
            task_type=task_type,
            target_column=target_column,
            feature_names=feature_names,
            target_classes=target_classes,
            metrics=metrics,
            training_parameters=training_parameters,
            artifact_path=artifact_path,
            artifact_size_bytes=artifact_size_bytes,
            status="ready",
            is_active=is_active,
            activated_at=now if is_active else None,
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    def delete(self, db: Session, model: RegisteredModel) -> None:
        db.delete(model)
        db.commit()

    def count_by_artifact_path(self, db: Session, artifact_path: str) -> int:
        return (
            db.query(func.count(RegisteredModel.id))
            .filter(RegisteredModel.artifact_path == artifact_path)
            .scalar()
            or 0
        )


model_registry_repository = ModelRegistryRepository()
