from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class AnomalyFeatureInfo(BaseModel):
    name: str
    data_type: str
    non_null_count: int
    missing_count: int
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    std: Optional[float] = None

class AnomalyFeaturesResponse(BaseModel):
    dataset_id: int
    is_cleaned: bool
    total_rows: int
    numeric_features: List[AnomalyFeatureInfo]
    recommended_features: List[str]

class AnomalyDistributionBucket(BaseModel):
    bucket_min: float
    bucket_max: float
    label: str
    count: int
    anomaly_count: int

class AnomalyEvaluationRequest(BaseModel):
    features: List[str] = Field(..., min_length=1, description="List of numeric features for anomaly detection")
    contamination: Optional[float] = Field(0.05, ge=0.001, le=0.5, description="Expected proportion of anomalies (0.001 to 0.5)")
    use_cleaned: bool = Field(True, description="Whether to use cleaned data")

class AnomalyEvaluationResponse(BaseModel):
    features: List[str]
    n_samples: int
    estimated_anomalies: int
    estimated_percentage: float
    threshold_score: float
    score_min: float
    score_max: float
    score_mean: float
    suggested_contamination: float
    score_distribution: List[AnomalyDistributionBucket]

class AnomalyRunRequest(BaseModel):
    features: List[str] = Field(..., min_length=1, description="List of numeric features for anomaly detection")
    contamination: Optional[float] = Field(0.05, ge=0.001, le=0.5, description="Expected proportion of anomalies (0.001 to 0.5)")
    name: Optional[str] = Field(None, max_length=100, description="Custom name for this anomaly detection run")
    n_estimators: Optional[int] = Field(100, ge=10, le=500, description="Number of Isolation Trees")
    use_cleaned: bool = Field(True, description="Whether to use cleaned data")

class FeatureDeviation(BaseModel):
    feature: str
    value: float
    inlier_mean: float
    inlier_std: float
    z_score: float
    severity: str  # 'high', 'medium', 'low'

class AnomalousRowDetail(BaseModel):
    index: int
    score: float
    normalized_score: float
    severity: str  # 'high', 'medium', 'low'
    feature_values: dict[str, Any]
    top_deviations: List[FeatureDeviation]

class AnomalyScatterPoint(BaseModel):
    index: int
    x: float
    y: float
    score: float
    normalized_score: float
    is_anomaly: bool

class AnomalyModelResponse(BaseModel):
    id: int
    dataset_id: int
    user_id: int
    name: str
    contamination: float
    n_estimators: int
    feature_names: List[str]
    use_cleaned: bool
    n_samples: int
    n_anomalies: int
    anomaly_percentage: float
    threshold_score: float
    score_min: float
    score_max: float
    score_mean: float
    summary_stats: Optional[dict[str, Any]] = None
    anomalous_rows: Optional[List[AnomalousRowDetail]] = None
    distribution_buckets: Optional[List[AnomalyDistributionBucket]] = None
    scatter_points: Optional[List[AnomalyScatterPoint]] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AnomalyModelSummary(BaseModel):
    id: int
    name: str
    contamination: float
    feature_names: List[str]
    n_samples: int
    n_anomalies: int
    anomaly_percentage: float
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
