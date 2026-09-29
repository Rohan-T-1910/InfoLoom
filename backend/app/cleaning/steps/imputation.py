from typing import Any, Optional
import numpy as np
import pandas as pd
from app.cleaning.base import CleaningStep

class MissingValueImputationStep(CleaningStep):
    """
    Imputes or handles missing values based on configurable statistical strategies:
    - Numeric: 'median' (robust default), 'mean', 'mode', 'constant', 'drop'
    - Categorical/String: 'mode' (most frequent), 'constant' ('Unknown'), 'drop'
    - Column dropping: drops columns with missing ratio > drop_column_threshold
    """

    def __init__(
        self,
        numeric_strategy: str = "median",
        categorical_strategy: str = "constant",
        numeric_fill_value: float = 0.0,
        categorical_fill_value: str = "Unknown",
        drop_column_threshold: Optional[float] = None,  # e.g. 0.85
    ):
        self.numeric_strategy = numeric_strategy.lower()
        self.categorical_strategy = categorical_strategy.lower()
        self.numeric_fill_value = numeric_fill_value
        self.categorical_fill_value = categorical_fill_value
        self.drop_column_threshold = drop_column_threshold

    @property
    def name(self) -> str:
        return "missing_value_imputation"

    def execute(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        df_cleaned = df.copy()
        dropped_columns: list[str] = []
        imputed_columns: dict[str, Any] = {}
        rows_before = len(df_cleaned)

        # 1. Optionally drop columns exceeding severe missingness threshold
        if self.drop_column_threshold is not None and 0.0 < self.drop_column_threshold <= 1.0:
            for col in list(df_cleaned.columns):
                missing_ratio = df_cleaned[col].isna().sum() / len(df_cleaned) if len(df_cleaned) > 0 else 0
                if missing_ratio >= self.drop_column_threshold:
                    df_cleaned.drop(columns=[col], inplace=True)
                    dropped_columns.append(col)

        # 2. Impute or handle remaining missing values per column
        for col in list(df_cleaned.columns):
            series = df_cleaned[col]
            missing_count = int(series.isna().sum())
            if missing_count == 0:
                continue

            is_numeric = pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series)

            if is_numeric:
                strategy = self.numeric_strategy
                if strategy == "drop":
                    df_cleaned = df_cleaned.dropna(subset=[col])
                    imputed_columns[col] = {"strategy": "drop", "dropped_rows": missing_count}
                elif strategy == "mean":
                    val = float(series.mean())
                    val = round(val, 4) if pd.notna(val) else self.numeric_fill_value
                    df_cleaned[col] = series.fillna(val)
                    imputed_columns[col] = {"strategy": "mean", "fill_value": val, "imputed_count": missing_count}
                elif strategy == "mode":
                    mode_s = series.mode()
                    val = float(mode_s.iloc[0]) if not mode_s.empty else self.numeric_fill_value
                    df_cleaned[col] = series.fillna(val)
                    imputed_columns[col] = {"strategy": "mode", "fill_value": val, "imputed_count": missing_count}
                elif strategy == "constant":
                    val = self.numeric_fill_value
                    df_cleaned[col] = series.fillna(val)
                    imputed_columns[col] = {"strategy": "constant", "fill_value": val, "imputed_count": missing_count}
                else:  # 'median' as default
                    val = float(series.median())
                    val = round(val, 4) if pd.notna(val) else self.numeric_fill_value
                    df_cleaned[col] = series.fillna(val)
                    imputed_columns[col] = {"strategy": "median", "fill_value": val, "imputed_count": missing_count}
            else:
                strategy = self.categorical_strategy
                if strategy == "drop":
                    df_cleaned = df_cleaned.dropna(subset=[col])
                    imputed_columns[col] = {"strategy": "drop", "dropped_rows": missing_count}
                elif strategy == "mode":
                    mode_s = series.mode()
                    val = str(mode_s.iloc[0]) if not mode_s.empty else self.categorical_fill_value
                    df_cleaned[col] = series.fillna(val)
                    imputed_columns[col] = {"strategy": "mode", "fill_value": val, "imputed_count": missing_count}
                else:  # 'constant'
                    val = self.categorical_fill_value
                    df_cleaned[col] = series.fillna(val)
                    imputed_columns[col] = {"strategy": "constant", "fill_value": val, "imputed_count": missing_count}

        rows_after = len(df_cleaned)
        summary = {
            "step": self.name,
            "numeric_strategy": self.numeric_strategy,
            "categorical_strategy": self.categorical_strategy,
            "dropped_columns": dropped_columns,
            "imputed_columns": imputed_columns,
            "rows_dropped": int(rows_before - rows_after),
        }
        return df_cleaned, summary
