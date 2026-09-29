from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

class ValidationReportResponse(BaseModel):
    dataset_id: int
    total_rows: int
    total_columns: int
    columns: list[str]
    duplicates: dict[str, Any]
    missing_values: dict[str, Any]
    columns_profile: dict[str, Any]
    outliers: dict[str, Any]

class CleaningConfig(BaseModel):
    dedup_keep: Literal["first", "last", False] = Field(
        default="first",
        description="Duplicate retention strategy: 'first', 'last', or False to drop all duplicates."
    )
    numeric_impute_strategy: Literal["median", "mean", "mode", "constant", "drop"] = Field(
        default="median",
        description="Strategy for numerical missing values (median is robust to skewed distributions)."
    )
    categorical_impute_strategy: Literal["mode", "constant", "drop"] = Field(
        default="constant",
        description="Strategy for categorical missing values."
    )
    numeric_fill_value: float = Field(
        default=0.0,
        description="Fill value when numeric_impute_strategy is 'constant'."
    )
    categorical_fill_value: str = Field(
        default="Unknown",
        description="Fill value when categorical_impute_strategy is 'constant'."
    )
    drop_column_threshold: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Optional ratio threshold above which columns with high missingness are dropped (e.g. 0.85)."
    )
    outlier_strategy: Literal["none", "clip", "remove"] = Field(
        default="none",
        description="Handling of outliers: 'none' (flag only), 'clip' (winsorize bounds), 'remove' (drop outlier rows)."
    )
    outlier_method: Literal["iqr", "zscore"] = Field(
        default="iqr",
        description="Outlier detection method: 'iqr' (1.5*IQR) or 'zscore' (|z| > 3)."
    )

class CleaningReportResponse(BaseModel):
    id: int
    dataset_id: int
    user_id: int
    validation_summary: dict[str, Any]
    cleaning_summary: dict[str, Any]
    cleaned_file_path: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
