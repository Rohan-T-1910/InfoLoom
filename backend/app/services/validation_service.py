from pathlib import Path
from typing import Any, Optional
import numpy as np
import pandas as pd

class DataValidationService:
    """
    Core validation engine for datasets:
    - Schema & Data type detection
    - Descriptive statistics (mean, median, std, percentiles)
    - Missing-value reports & missingness analysis
    - Duplicate detection
    - Outlier detection via IQR and Z-score methods
    """

    def read_dataset_df(self, file_path: str | Path) -> pd.DataFrame:
        """Reads CSV file into DataFrame using robust encoding detection and whitespace normalization."""
        encodings = ["utf-8-sig", "utf-8", "latin-1"]
        null_equivalents = {"", " ", "na", "n/a", "null", "none", "nan"}
        df: Optional[pd.DataFrame] = None
        for enc in encodings:
            try:
                df = pd.read_csv(file_path, encoding=enc)
                break
            except UnicodeDecodeError:
                continue

        if df is None:
            raise ValueError("Could not decode CSV file with supported encodings.")

        # Strip whitespace from column headers
        df.columns = df.columns.astype(str).str.strip()

        # Normalize empty/whitespace-only strings to NaN for accurate missingness detection
        for col in df.columns:
            if pd.api.types.is_string_dtype(df[col]) or pd.api.types.is_object_dtype(df[col]):
                df[col] = df[col].apply(
                    lambda x: np.nan if (isinstance(x, str) and x.strip().lower() in null_equivalents) else x
                )

        return df


    def _sanitize_for_json(self, value: Any) -> Any:
        """Converts numpy / NaN / infinite values to standard JSON-serializable types."""
        if value is None:
            return None
        if isinstance(value, (np.integer, int)):
            return int(value)
        if isinstance(value, (np.floating, float)):
            if np.isnan(value) or np.isinf(value):
                return None
            return float(round(value, 4))
        if isinstance(value, (np.bool_, bool)):
            return bool(value)
        if isinstance(value, (pd.Timestamp, np.datetime64)):
            return str(value)
        return value

    def validate_dataframe(self, df: pd.DataFrame) -> dict[str, Any]:
        """Performs complete validation and statistical profiling on a DataFrame."""
        total_rows = int(len(df))
        total_columns = int(len(df.columns))

        if total_rows == 0:
            return {
                "total_rows": 0,
                "total_columns": total_columns,
                "columns": list(df.columns),
                "summary": {},
                "missing_values": {"total_missing": 0, "missing_percentage": 0.0, "columns": {}},
                "duplicates": {"count": 0, "percentage": 0.0},
                "outliers": {},
            }

        # 1. Duplicates Analysis
        duplicate_count = int(df.duplicated().sum())
        duplicate_pct = round((duplicate_count / total_rows) * 100, 2) if total_rows > 0 else 0.0

        # 2. Missing Values Analysis
        missing_per_col = df.isna().sum()
        total_missing = int(missing_per_col.sum())
        total_cells = total_rows * total_columns
        overall_missing_pct = round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0
        rows_with_missing = int(df.isna().any(axis=1).sum())
        rows_with_missing_pct = round((rows_with_missing / total_rows) * 100, 2) if total_rows > 0 else 0.0

        missing_details: dict[str, Any] = {}
        for col in df.columns:
            m_count = int(missing_per_col[col])
            m_pct = round((m_count / total_rows) * 100, 2) if total_rows > 0 else 0.0

            # Missingness severity classification
            if m_count == 0:
                severity = "none"
            elif m_pct < 5.0:
                severity = "low"  # Often MCAR; safe for simple imputation or deletion
            elif m_pct <= 20.0:
                severity = "moderate"  # May require targeted imputation (median/mean/mode)
            else:
                severity = "severe"  # Consider column drop or model-based imputation

            missing_details[col] = {
                "missing_count": m_count,
                "missing_percentage": m_pct,
                "present_count": total_rows - m_count,
                "severity": severity,
            }

        # 3. Schema & Descriptive Statistics & Outliers
        columns_profile: dict[str, Any] = {}
        outliers_report: dict[str, Any] = {}

        for col in df.columns:
            series = df[col]
            inferred_type = self._infer_column_type(series)
            unique_count = int(series.nunique(dropna=True))

            col_stats: dict[str, Any] = {
                "inferred_type": inferred_type,
                "unique_values": unique_count,
                "cardinality_ratio": round(unique_count / total_rows, 4) if total_rows > 0 else 0.0,
            }

            # Numerical Analysis (raw numeric or formatted numeric strings)
            is_num_dtype = pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series)
            if is_num_dtype or inferred_type == "numeric":
                if not is_num_dtype:
                    cleaned_num = series.dropna().astype(str).str.replace(r"[^\d.-]", "", regex=True)
                    clean_series = pd.to_numeric(cleaned_num, errors="coerce").dropna()
                else:
                    clean_series = series.dropna()

                if len(clean_series) > 0:
                    mean_val = float(clean_series.mean())
                    std_val = float(clean_series.std(ddof=1)) if len(clean_series) > 1 else 0.0
                    min_val = float(clean_series.min())
                    max_val = float(clean_series.max())
                    q1 = float(clean_series.quantile(0.25))
                    median_val = float(clean_series.median())
                    q3 = float(clean_series.quantile(0.75))
                    iqr = q3 - q1

                    col_stats.update({
                        "count": int(len(clean_series)),
                        "mean": self._sanitize_for_json(mean_val),
                        "std": self._sanitize_for_json(std_val),
                        "min": self._sanitize_for_json(min_val),
                        "q25": self._sanitize_for_json(q1),
                        "median": self._sanitize_for_json(median_val),
                        "q75": self._sanitize_for_json(q3),
                        "max": self._sanitize_for_json(max_val),
                        "iqr": self._sanitize_for_json(iqr),
                    })

                    # Outlier Detection (IQR Method)
                    iqr_lower = q1 - 1.5 * iqr
                    iqr_upper = q3 + 1.5 * iqr
                    iqr_outliers = clean_series[(clean_series < iqr_lower) | (clean_series > iqr_upper)]
                    iqr_outlier_count = int(len(iqr_outliers))
                    iqr_outlier_pct = round((iqr_outlier_count / len(clean_series)) * 100, 2)


                    # Outlier Detection (Z-Score Method)
                    if std_val > 0:
                        z_scores = np.abs((clean_series - mean_val) / std_val)
                        z_outliers = clean_series[z_scores > 3.0]
                        z_outlier_count = int(len(z_outliers))
                        z_outlier_pct = round((z_outlier_count / len(clean_series)) * 100, 2)
                        z_lower = mean_val - 3.0 * std_val
                        z_upper = mean_val + 3.0 * std_val
                    else:
                        z_outlier_count = 0
                        z_outlier_pct = 0.0
                        z_lower = min_val
                        z_upper = max_val

                    outliers_report[col] = {
                        "iqr_method": {
                            "lower_bound": self._sanitize_for_json(iqr_lower),
                            "upper_bound": self._sanitize_for_json(iqr_upper),
                            "outlier_count": iqr_outlier_count,
                            "outlier_percentage": iqr_outlier_pct,
                        },
                        "zscore_method": {
                            "threshold": 3.0,
                            "lower_bound": self._sanitize_for_json(z_lower),
                            "upper_bound": self._sanitize_for_json(z_upper),
                            "outlier_count": z_outlier_count,
                            "outlier_percentage": z_outlier_pct,
                        },
                    }
            elif pd.api.types.is_datetime64_any_dtype(series):
                clean_series = series.dropna()
                if len(clean_series) > 0:
                    col_stats.update({
                        "count": int(len(clean_series)),
                        "min": str(clean_series.min()),
                        "max": str(clean_series.max()),
                    })
            else:
                # Categorical / String
                clean_series = series.dropna().astype(str)
                if len(clean_series) > 0:
                    mode_val = clean_series.mode()
                    top_value = str(mode_val.iloc[0]) if not mode_val.empty else None
                    top_freq = int((clean_series == top_value).sum()) if top_value else 0
                    col_stats.update({
                        "count": int(len(clean_series)),
                        "top_value": top_value,
                        "top_frequency": top_freq,
                    })

            columns_profile[col] = col_stats

        return {
            "total_rows": total_rows,
            "total_columns": total_columns,
            "columns": list(df.columns),
            "duplicates": {
                "count": duplicate_count,
                "percentage": duplicate_pct,
            },
            "missing_values": {
                "total_missing_cells": total_missing,
                "overall_missing_percentage": overall_missing_pct,
                "rows_with_missing_count": rows_with_missing,
                "rows_with_missing_percentage": rows_with_missing_pct,
                "columns": missing_details,
            },
            "columns_profile": columns_profile,
            "outliers": outliers_report,
        }

    def _infer_column_type(self, series: pd.Series) -> str:
        """Determines fine-grained semantic column data type."""
        if pd.api.types.is_bool_dtype(series):
            return "boolean"
        if pd.api.types.is_integer_dtype(series):
            return "integer"
        if pd.api.types.is_float_dtype(series):
            return "float"
        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"

        # Check if object series can be inferred as numeric, date, or boolean
        clean = series.dropna()
        if len(clean) == 0:
            return "empty"

        sample = clean.head(100).astype(str).str.strip()
        # Check boolean strings
        bool_strings = {"true", "false", "yes", "no", "1", "0", "t", "f"}
        if all(s.lower() in bool_strings for s in sample):
            return "boolean"

        # Check numeric strings (direct or formatted with currency/commas)
        try:
            pd.to_numeric(sample)
            return "numeric"
        except (ValueError, TypeError):
            try:
                cleaned_sample = sample.str.replace(r"[^\d.-]", "", regex=True)
                non_empty = cleaned_sample[cleaned_sample != ""]
                if len(non_empty) >= 0.8 * len(sample):
                    pd.to_numeric(non_empty, errors="raise")
                    return "numeric"
            except Exception:
                pass


        # Check datetime strings
        try:
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                pd.to_datetime(sample, errors="raise")
            return "datetime"
        except (ValueError, TypeError, Exception):
            pass

        return "categorical"


validation_service = DataValidationService()
