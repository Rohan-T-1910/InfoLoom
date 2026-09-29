from typing import Any
import numpy as np
import pandas as pd
from app.cleaning.base import CleaningStep

class OutlierHandlingStep(CleaningStep):
    """
    Handles numerical outliers via configurable method and strategy:
    - method: 'iqr' (1.5 * IQR) or 'zscore' (|z| > 3)
    - strategy:
      - 'none': logs outliers without modification (default)
      - 'clip': winsorizes / clamps outlier values to lower and upper bounds
      - 'remove': drops rows containing outliers
    """

    def __init__(
        self,
        strategy: str = "none",
        method: str = "iqr",
        iqr_multiplier: float = 1.5,
        zscore_threshold: float = 3.0,
    ):
        self.strategy = strategy.lower()
        self.method = method.lower()
        self.iqr_multiplier = iqr_multiplier
        self.zscore_threshold = zscore_threshold

    @property
    def name(self) -> str:
        return "outlier_handling"

    def execute(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        df_cleaned = df.copy()
        outliers_handled: dict[str, Any] = {}
        rows_before = len(df_cleaned)

        if self.strategy == "none" or rows_before == 0:
            return df_cleaned, {
                "step": self.name,
                "strategy": "none",
                "method": self.method,
                "outliers_modified": 0,
            }

        numeric_cols = [
            c for c in df_cleaned.columns
            if pd.api.types.is_numeric_dtype(df_cleaned[c]) and not pd.api.types.is_bool_dtype(df_cleaned[c])
        ]

        rows_to_drop = set()

        for col in numeric_cols:
            series = df_cleaned[col].dropna()
            if len(series) < 4:
                continue

            if self.method == "zscore":
                mean_val = float(series.mean())
                std_val = float(series.std(ddof=1))
                if std_val == 0:
                    continue
                lower_bound = mean_val - self.zscore_threshold * std_val
                upper_bound = mean_val + self.zscore_threshold * std_val
            else:  # 'iqr'
                q1 = float(series.quantile(0.25))
                q3 = float(series.quantile(0.75))
                iqr = q3 - q1
                lower_bound = q1 - self.iqr_multiplier * iqr
                upper_bound = q3 + self.iqr_multiplier * iqr

            outlier_mask = (df_cleaned[col] < lower_bound) | (df_cleaned[col] > upper_bound)
            outlier_count = int(outlier_mask.sum())

            if outlier_count > 0:
                if self.strategy == "clip":
                    df_cleaned[col] = df_cleaned[col].astype("float64").clip(lower=lower_bound, upper=upper_bound)
                    outliers_handled[col] = {
                        "strategy": "clip",
                        "method": self.method,
                        "lower_bound": round(lower_bound, 4),
                        "upper_bound": round(upper_bound, 4),
                        "values_clipped": outlier_count,
                    }

                elif self.strategy == "remove":
                    outlier_indices = df_cleaned[outlier_mask].index
                    rows_to_drop.update(outlier_indices)
                    outliers_handled[col] = {
                        "strategy": "remove",
                        "method": self.method,
                        "outlier_rows_flagged": outlier_count,
                    }

        if self.strategy == "remove" and rows_to_drop:
            df_cleaned = df_cleaned.drop(index=list(rows_to_drop))

        rows_after = len(df_cleaned)

        summary = {
            "step": self.name,
            "strategy": self.strategy,
            "method": self.method,
            "columns_handled": outliers_handled,
            "rows_dropped": int(rows_before - rows_after),
        }
        return df_cleaned, summary
