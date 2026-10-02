from datetime import datetime
from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class InsightCategory(str, Enum):
    PERCENTAGE_CHANGE = "percentage_change"
    TOP_CONTRIBUTOR = "top_contributor"
    TREND = "trend"
    DISTRIBUTION = "distribution"
    CORRELATION = "correlation"
    FORECAST = "forecast"
    ANOMALY = "anomaly"
    MODEL_PERFORMANCE = "model_performance"
    DATA_QUALITY = "data_quality"

class InsightSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    POSITIVE = "positive"
    INFO = "info"

class InsightDirection(str, Enum):
    UPWARD = "upward"
    DOWNWARD = "downward"
    POSITIVE = "positive"
    NEGATIVE = "negative"
    CONCENTRATED = "concentrated"
    SKEWED = "skewed"
    ANOMALOUS = "anomalous"
    NEUTRAL = "neutral"

class StructuredInsightFact(BaseModel):
    id: str = Field(..., description="Unique deterministic identifier for deduplication")
    category: str = Field(..., description="Insight category/type")
    title: str = Field(..., description="Headline describing the insight")
    severity: str = Field(..., description="Severity: critical, warning, positive, info")
    direction: str = Field(..., description="Direction/trend of observation")
    feature: str = Field(..., description="Primary metric or feature")
    secondary_feature: Optional[str] = Field(None, description="Optional secondary feature (e.g. for correlation)")
    current_value: Optional[float] = Field(None, description="Current or latest observation value")
    comparison_value: Optional[float] = Field(None, description="Baseline or previous comparison value")
    change_pct: Optional[float] = Field(None, description="Percentage change if applicable")
    change_abs: Optional[float] = Field(None, description="Absolute change if applicable")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence / evidence strength score (0 to 1)")
    explanation: str = Field(..., description="Deterministic template-generated explanation")
    polished_explanation: Optional[str] = Field(None, description="Optional LLM-polished natural phrasing")
    supporting_evidence: dict[str, Any] = Field(default_factory=dict, description="Concrete supporting mathematical facts")
    is_llm_polished: bool = Field(False, description="Whether LLM phrasing was applied and passed factual guardrails")

class InsightKPISummary(BaseModel):
    total_insights: int = 0
    critical_count: int = 0
    warning_count: int = 0
    positive_count: int = 0
    info_count: int = 0
    categories_covered: List[str] = Field(default_factory=list)

class InsightGenerateRequest(BaseModel):
    use_cleaned: bool = Field(True, description="Whether to use cleaned data pipeline")
    include_llm: bool = Field(False, description="Whether to optionally request LLM natural phrasing layer")
    categories: Optional[List[str]] = Field(None, description="Optional subset of categories to generate")
    pct_change_threshold: Optional[float] = Field(None, ge=1.0, le=500.0, description="Custom percentage change threshold")

class InsightReportResponse(BaseModel):
    id: int
    dataset_id: int
    user_id: int
    title: str
    summary: Optional[str] = None
    total_insights: int
    is_cleaned: bool
    llm_polished: bool
    kpi_summary: InsightKPISummary
    categories: List[str]
    insights: List[StructuredInsightFact]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class InsightSummaryResponse(BaseModel):
    dataset_id: int
    has_report: bool
    total_insights: int
    kpi_summary: Optional[InsightKPISummary] = None
    top_insights: List[StructuredInsightFact] = Field(default_factory=list)
    created_at: Optional[datetime] = None
