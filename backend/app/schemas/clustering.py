from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

class ClusteringFeatureInfo(BaseModel):
    name: str
    data_type: str
    non_null_count: int
    missing_count: int
    mean: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None

class ClusteringFeaturesResponse(BaseModel):
    dataset_id: int
    is_cleaned: bool
    total_rows: int
    numeric_features: list[ClusteringFeatureInfo]
    recommended_features: list[str]

class ClusteringEvaluationRequest(BaseModel):
    features: list[str] = Field(..., min_length=1, description="List of numeric column names to evaluate")
    k_min: int = Field(default=2, ge=2, le=10, description="Minimum K to evaluate")
    k_max: int = Field(default=8, ge=2, le=15, description="Maximum K to evaluate")
    use_cleaned: bool = Field(default=True, description="Use cleaned dataset if available")

class KMeansKMetric(BaseModel):
    k: int
    inertia: float
    silhouette_score: Optional[float] = None

class ClusteringEvaluationResponse(BaseModel):
    features: list[str]
    n_samples: int
    k_metrics: list[KMeansKMetric]
    suggested_k: int
    suggestion_reason: str

class ClusteringRunRequest(BaseModel):
    features: list[str] = Field(..., min_length=1, description="List of numeric column names to cluster")
    k: int = Field(default=3, ge=2, le=20, description="Number of clusters")
    name: Optional[str] = Field(default=None, max_length=100, description="Optional custom name for this clustering model")
    use_cleaned: bool = Field(default=True, description="Use cleaned dataset if available")

class ClusterFeatureStat(BaseModel):
    feature: str
    mean: float
    median: float
    std: float
    min: float
    max: float

class ClusterProfile(BaseModel):
    cluster_id: int
    name: str
    size: int
    percentage: float
    stats: list[ClusterFeatureStat]

class ClusteringDataPoint(BaseModel):
    index: int
    cluster: int
    x: Optional[float] = None
    y: Optional[float] = None
    features: dict[str, Any]

class ClusteringModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    user_id: int
    name: str
    k: int
    feature_names: list[str]
    use_cleaned: bool
    n_samples: int
    inertia: float
    silhouette_score: Optional[float] = None
    cluster_centers: dict[str, list[float]]
    cluster_profiles: list[ClusterProfile]
    evaluation_metrics: Optional[dict[str, Any]] = None
    sample_assignments: Optional[list[ClusteringDataPoint]] = None
    status: str
    created_at: datetime

class ClusteringModelSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    k: int
    feature_names: list[str]
    n_samples: int
    inertia: float
    silhouette_score: Optional[float] = None
    status: str
    created_at: datetime
