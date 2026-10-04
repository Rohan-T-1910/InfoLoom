from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

class TimeSeriesDateColumnInfo(BaseModel):
    name: str
    non_null_count: int
    missing_count: int
    sample_values: list[str]
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    inferred_frequency: Optional[str] = None

class TimeSeriesNumericColumnInfo(BaseModel):
    name: str
    data_type: str
    non_null_count: int
    missing_count: int
    mean: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None

class ForecastingColumnsResponse(BaseModel):
    dataset_id: int
    is_cleaned: bool
    total_rows: int
    date_columns: list[TimeSeriesDateColumnInfo]
    numeric_columns: list[TimeSeriesNumericColumnInfo]
    recommended_date_column: Optional[str] = None
    recommended_target_column: Optional[str] = None

class TimeSeriesPoint(BaseModel):
    date: str
    value: float

class ForecastValidationPoint(BaseModel):
    date: str
    actual: float
    predicted: float
    lower_ci: Optional[float] = None
    upper_ci: Optional[float] = None

class FutureForecastPoint(BaseModel):
    date: str
    forecast: float
    lower_ci: float
    upper_ci: float

class ForecastMetrics(BaseModel):
    mape: float
    rmse: float
    mae: float
    r2: Optional[float] = None
    validation_horizon: int
    direction_accuracy: Optional[float] = None

class ForecastEvaluationRequest(BaseModel):
    date_column: str = Field(..., description="Timestamp/date column")
    target_column: str = Field(..., description="Numeric target/metric column to forecast")
    forecast_horizon: int = Field(default=7, ge=1, le=90, description="Steps ahead to forecast")
    frequency: Optional[str] = Field(default=None, description="Resampling frequency: 'D', 'W', 'M', 'h', or auto-inferred")
    use_cleaned: bool = Field(default=True, description="Use cleaned dataset if available")

class ForecastEvaluationResponse(BaseModel):
    date_column: str
    target_column: str
    frequency: str
    n_historical_points: int
    validation_horizon: int
    metrics: ForecastMetrics
    validation_points: list[ForecastValidationPoint]
    summary_notes: str

class ForecastRunRequest(BaseModel):
    date_column: str = Field(..., description="Timestamp/date column")
    target_column: str = Field(..., description="Numeric target/metric column to forecast")
    forecast_horizon: int = Field(default=7, ge=1, le=90, description="Steps ahead to forecast")
    frequency: Optional[str] = Field(default=None, description="Resampling frequency: 'D', 'W', 'M', 'h', or auto-inferred")
    name: Optional[str] = Field(default=None, max_length=100, description="Optional custom name for this forecast model")
    use_cleaned: bool = Field(default=True, description="Use cleaned dataset if available")

class ForecastModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    user_id: int
    name: str
    date_column: str
    target_column: str
    forecast_horizon: int
    frequency: str
    use_cleaned: bool
    n_historical_points: int
    metrics: dict[str, Any]
    mape: Optional[float] = None
    rmse: Optional[float] = None
    model_type: Optional[str] = "ARIMA"
    model_parameters: dict[str, Any]
    historical_points: list[dict[str, Any]]
    validation_points: Optional[list[dict[str, Any]]] = None
    forecast_points: list[dict[str, Any]]
    status: str
    created_at: datetime

    @model_validator(mode="after")
    def populate_top_level_metrics(self):
        if self.metrics and isinstance(self.metrics, dict):
            if self.mape is None and "mape" in self.metrics:
                try:
                    self.mape = float(self.metrics["mape"])
                except (ValueError, TypeError):
                    pass
            if self.rmse is None and "rmse" in self.metrics:
                try:
                    self.rmse = float(self.metrics["rmse"])
                except (ValueError, TypeError):
                    pass
        return self

class ForecastModelSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    date_column: str
    target_column: str
    forecast_horizon: int
    frequency: str
    n_historical_points: int
    metrics: dict[str, Any]
    mape: Optional[float] = None
    rmse: Optional[float] = None
    model_type: Optional[str] = "ARIMA"
    status: str
    created_at: datetime

    @model_validator(mode="after")
    def populate_top_level_metrics(self):
        if self.metrics and isinstance(self.metrics, dict):
            if self.mape is None and "mape" in self.metrics:
                try:
                    self.mape = float(self.metrics["mape"])
                except (ValueError, TypeError):
                    pass
            if self.rmse is None and "rmse" in self.metrics:
                try:
                    self.rmse = float(self.metrics["rmse"])
                except (ValueError, TypeError):
                    pass
        return self
