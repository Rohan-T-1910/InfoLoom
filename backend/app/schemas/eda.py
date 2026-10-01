from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

class DatasetKPIs(BaseModel):
    row_count: int
    column_count: int
    total_cells: int
    missing_cells: int
    missing_percentage: float
    duplicate_rows: int
    duplicate_percentage: float
    numeric_columns_count: int
    categorical_columns_count: int
    memory_bytes: int
    memory_human: str

class NumericColumnStats(BaseModel):
    data_type: str = "numeric"
    count: int
    missing_count: int
    missing_percentage: float
    mean: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    q25: Optional[float] = None
    median: Optional[float] = None
    q75: Optional[float] = None
    max: Optional[float] = None
    iqr: Optional[float] = None
    skewness: Optional[float] = None
    kurtosis: Optional[float] = None
    zeros_count: int = 0
    zeros_percentage: float = 0.0

class CategoryFrequency(BaseModel):
    category: str
    count: int
    percentage: float

class CategoricalColumnStats(BaseModel):
    data_type: str = "categorical"
    count: int
    missing_count: int
    missing_percentage: float
    unique: int
    mode: Optional[str] = None
    mode_frequency: Optional[int] = None
    top_categories: list[CategoryFrequency] = []

class CorrelationPair(BaseModel):
    feature_a: str
    feature_b: str
    correlation: float
    abs_correlation: float
    relationship: str

class CorrelationMatrixResponse(BaseModel):
    columns: list[str]
    matrix: dict[str, dict[str, Optional[float]]]
    strong_correlations: list[CorrelationPair]
    warnings: list[str]

class DistributionBin(BaseModel):
    bin_start: Optional[float] = None
    bin_end: Optional[float] = None
    label: str
    count: int
    percentage: float

class ColumnDistribution(BaseModel):
    column_name: str
    data_type: str
    bins: list[DistributionBin]
    summary: dict[str, Any] = {}

class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float
    percentage: float
    rank: int

class FeatureImportanceResponse(BaseModel):
    target_column: str
    problem_type: str
    model_used: str
    baseline_score_name: str
    baseline_score: Optional[float] = None
    features: list[FeatureImportanceItem]
    candidate_targets: list[str] = []

class EDARequestConfig(BaseModel):
    target_column: Optional[str] = Field(default=None, description="Target feature to evaluate importance against.")
    use_cleaned: bool = Field(default=True, description="Whether to analyze cleaned data if available.")
    force_refresh: bool = Field(default=False, description="Bypass cache and recompute analysis.")

class EDAResponse(BaseModel):
    id: Optional[int] = None
    dataset_id: int
    is_cleaned: bool
    target_column: Optional[str] = None
    kpis: DatasetKPIs
    summary_statistics: dict[str, Any]
    correlation_matrix: CorrelationMatrixResponse
    distributions: dict[str, ColumnDistribution]
    feature_importance: Optional[FeatureImportanceResponse] = None
    cached: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
