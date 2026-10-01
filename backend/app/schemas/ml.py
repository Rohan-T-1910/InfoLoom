from datetime import datetime
from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field

class MLTrainRequest(BaseModel):
    task_type: Literal["regression", "classification"] = Field(
        description="Machine learning problem type"
    )
    target_column: str = Field(
        description="Name of the target variable column in the dataset"
    )
    feature_columns: Optional[list[str]] = Field(
        default=None,
        description="List of feature column names. If omitted, all non-target, non-ID columns are used."
    )
    test_size: float = Field(
        default=0.2,
        ge=0.05,
        le=0.5,
        description="Holdout test split ratio (e.g. 0.2 for an 80/20 train/test split)"
    )
    use_cleaned: bool = Field(
        default=True,
        description="Train on cleaned dataset artifact if available; otherwise use raw data"
    )
    cv_folds: int = Field(
        default=5,
        ge=2,
        le=10,
        description="Number of cross-validation folds"
    )
    algorithms: Optional[list[str]] = Field(
        default=None,
        description="Optional subset of algorithms to train (e.g. ['linear', 'random_forest', 'xgboost'])"
    )

class MLModelLeaderboardItem(BaseModel):
    id: int
    name: str
    algorithm: str
    task_type: str
    metrics: dict[str, Any]
    hyperparameters: dict[str, Any]
    is_best: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class MLJobResponse(BaseModel):
    id: int
    dataset_id: int
    user_id: int
    task_type: str
    target_column: str
    feature_columns: list[str]
    test_size: float
    use_cleaned: bool
    status: str
    error_message: Optional[str] = None
    leaderboard: Optional[list[dict[str, Any]]] = None
    best_model_id: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class MLModelDetailResponse(BaseModel):
    id: int
    job_id: int
    dataset_id: int
    user_id: int
    name: str
    algorithm: str
    task_type: str
    target_column: str
    feature_names: list[str]
    target_classes: Optional[list[Any]] = None
    metrics: dict[str, Any]
    hyperparameters: dict[str, Any]
    is_best: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class MLPredictRequest(BaseModel):
    inputs: Union[dict[str, Any], list[dict[str, Any]]] = Field(
        description="Single feature dictionary or list of feature dictionaries for batch prediction"
    )

class MLPredictResponse(BaseModel):
    model_id: int
    model_name: str
    task_type: str
    predictions: list[Any]
    probabilities: Optional[list[dict[str, float]]] = None
    feature_names: list[str]

class MLTargetInspectionResponse(BaseModel):
    target_column: str
    inferred_task_type: str
    unique_count: int
    sample_values: list[Any]
    candidate_features: list[str]
    is_supported: bool
    warning: Optional[str] = None
