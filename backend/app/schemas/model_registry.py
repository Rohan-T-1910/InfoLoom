from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

class RegisterModelRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Logical model identifier or model family name (e.g. churn-predictor)")
    dataset_id: int = Field(..., description="ID of the dataset associated with this model")
    source_model_id: Optional[int] = Field(None, description="Optional ID of trained MLModel from Phase 4 to register")
    description: Optional[str] = Field(None, max_length=500, description="Optional release notes or model description")
    set_active: bool = Field(True, description="Whether to automatically mark this version as active")
    # Optional explicit fields when registering without a source_model_id
    algorithm: Optional[str] = None
    task_type: Optional[str] = None
    target_column: Optional[str] = None
    feature_names: Optional[list[str]] = None
    target_classes: Optional[list[Any]] = None
    metrics: Optional[dict[str, Any]] = None
    training_parameters: Optional[dict[str, Any]] = None
    artifact_path: Optional[str] = None


class RollbackModelRequest(BaseModel):
    target_version: Optional[int] = Field(None, description="Specific version number to roll back to. If omitted, rolls back to previous version.")


class RegisteredModelResponse(BaseModel):
    id: int
    name: str
    version: int
    description: Optional[str] = None
    user_id: int
    dataset_id: int
    dataset_name: Optional[str] = None
    source_model_id: Optional[int] = None
    algorithm: str
    task_type: str
    target_column: str
    feature_names: list[str]
    target_classes: Optional[list[Any]] = None
    metrics: dict[str, Any]
    training_parameters: dict[str, Any]
    artifact_path: str
    artifact_size_bytes: Optional[int] = None
    has_artifact: bool = True
    status: str
    is_active: bool
    activated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegisteredModelListResponse(BaseModel):
    items: list[RegisteredModelResponse]
    total: int
