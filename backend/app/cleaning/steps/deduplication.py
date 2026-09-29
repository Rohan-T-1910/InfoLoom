from typing import Any
import pandas as pd
from app.cleaning.base import CleaningStep

class DeduplicationStep(CleaningStep):
    """Identifies and drops exact duplicate rows in the dataset."""

    def __init__(self, keep: str = "first"):
        self.keep = keep

    @property
    def name(self) -> str:
        return "deduplication"

    def execute(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        initial_rows = len(df)
        df_cleaned = df.drop_duplicates(keep=self.keep)
        rows_after = len(df_cleaned)
        duplicates_removed = initial_rows - rows_after

        summary = {
            "step": self.name,
            "keep": self.keep,
            "duplicates_removed": int(duplicates_removed),
            "rows_before": int(initial_rows),
            "rows_after": int(rows_after),
        }
        return df_cleaned, summary
