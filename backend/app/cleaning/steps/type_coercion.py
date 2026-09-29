import re
from typing import Any
import pandas as pd
from app.cleaning.base import CleaningStep

class TypeCoercionStep(CleaningStep):
    """
    Standardizes and coerces column types:
    - Strips leading/trailing whitespace
    - Replaces empty string representations ('', 'NA', 'N/A', 'null', 'None') with NaN
    - Converts numbers stored as formatted strings (e.g., '$1,250.00', '15%') to float/int
    - Converts boolean strings ('true'/'false', 'yes'/'no') to boolean
    - Parses date-like columns to datetime
    """

    @property
    def name(self) -> str:
        return "type_coercion"

    def execute(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        df_cleaned = df.copy()
        coerced_columns: dict[str, Any] = {}

        null_equivalents = {"", " ", "na", "n/a", "null", "none", "nan"}

        for col in df_cleaned.columns:
            series = df_cleaned[col]
            orig_dtype = str(series.dtype)

            # Process object or string dtype series for coercion
            if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
                # 1. Clean string whitespace & null equivalents
                cleaned_series = series.apply(
                    lambda x: None if (isinstance(x, str) and x.strip().lower() in null_equivalents)
                    else (x.strip() if isinstance(x, str) else x)
                )

                non_nulls = cleaned_series.dropna()
                if len(non_nulls) == 0:
                    df_cleaned[col] = cleaned_series
                    continue

                str_sample = non_nulls.head(50).astype(str)

                # 2. Try boolean coercion
                bool_map = {
                    "true": True, "false": False,
                    "yes": True, "no": False,
                    "t": True, "f": False,
                    "1": True, "0": False
                }
                if all(s.lower() in bool_map for s in str_sample):
                    coerced = cleaned_series.map(lambda x: bool_map.get(str(x).strip().lower()) if pd.notna(x) else x)
                    df_cleaned[col] = coerced.astype("boolean")
                    coerced_columns[col] = {
                        "from_type": orig_dtype,
                        "to_type": "boolean",
                        "status": "converted",
                    }
                    continue

                # 3. Try numeric coercion (stripping currency symbols, commas, percent signs)
                cleaned_numeric = cleaned_series.apply(
                    lambda x: re.sub(r"[^\d.-]", "", str(x)) if pd.notna(x) else x
                )
                try:
                    num_converted = pd.to_numeric(cleaned_numeric, errors="coerce")
                    # If conversion maintains high valid ratio (>= 90% of non-nulls)
                    valid_ratio = num_converted.notna().sum() / len(non_nulls)
                    if valid_ratio >= 0.9:
                        # Decide integer vs float
                        non_na_vals = num_converted.dropna()
                        is_all_int = (non_na_vals % 1 == 0).all()
                        target_type = "Int64" if is_all_int else "float64"
                        df_cleaned[col] = num_converted.astype(target_type)
                        coerced_columns[col] = {
                            "from_type": orig_dtype,
                            "to_type": target_type,
                            "status": "converted",
                        }
                        continue
                except Exception:
                    pass

                # 4. Try datetime coercion
                try:
                    import warnings
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        dt_converted = pd.to_datetime(cleaned_series, errors="coerce")
                    if dt_converted.notna().sum() / len(non_nulls) >= 0.85:
                        df_cleaned[col] = dt_converted
                        coerced_columns[col] = {
                            "from_type": orig_dtype,
                            "to_type": "datetime64[ns]",
                            "status": "converted",
                        }
                        continue
                except Exception:
                    pass


                # If retained as string/object, store stripped whitespace series
                df_cleaned[col] = cleaned_series


        summary = {
            "step": self.name,
            "columns_coerced_count": len(coerced_columns),
            "columns": coerced_columns,
        }
        return df_cleaned, summary
