from typing import Any, Optional
import pandas as pd
from app.cleaning.base import CleaningStep
from app.cleaning.steps.deduplication import DeduplicationStep
from app.cleaning.steps.type_coercion import TypeCoercionStep
from app.cleaning.steps.imputation import MissingValueImputationStep
from app.cleaning.steps.outliers import OutlierHandlingStep

class CleaningPipeline:
    """
    Executes a sequence of modular, swappable CleaningStep strategies.
    Ensures idempotency, auditability, and structured transformation reporting.
    """

    def __init__(self, steps: Optional[list[CleaningStep]] = None):
        self.steps: list[CleaningStep] = steps or []

    def add_step(self, step: CleaningStep) -> "CleaningPipeline":
        """Appends a new cleaning step to the pipeline."""
        self.steps.append(step)
        return self

    @classmethod
    def create_default_pipeline(
        cls,
        dedup_keep: str = "first",
        numeric_impute_strategy: str = "median",
        categorical_impute_strategy: str = "constant",
        numeric_fill_value: float = 0.0,
        categorical_fill_value: str = "Unknown",
        drop_column_threshold: Optional[float] = None,
        outlier_strategy: str = "none",
        outlier_method: str = "iqr",
    ) -> "CleaningPipeline":
        """Factory method to construct a standard cleaning pipeline with provided configs."""
        pipeline = cls()
        pipeline.add_step(DeduplicationStep(keep=dedup_keep))
        pipeline.add_step(TypeCoercionStep())
        pipeline.add_step(
            MissingValueImputationStep(
                numeric_strategy=numeric_impute_strategy,
                categorical_strategy=categorical_impute_strategy,
                numeric_fill_value=numeric_fill_value,
                categorical_fill_value=categorical_fill_value,
                drop_column_threshold=drop_column_threshold,
            )
        )
        pipeline.add_step(
            OutlierHandlingStep(
                strategy=outlier_strategy,
                method=outlier_method,
            )
        )
        return pipeline

    def run(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        """
        Executes all steps in order on the DataFrame.
        Returns:
            pd.DataFrame: Fully cleaned DataFrame.
            dict[str, Any]: Comprehensive audit summary of all pipeline actions.
        """
        initial_rows = int(len(df))
        initial_cols = int(len(df.columns))

        current_df = df.copy()
        step_summaries: list[dict[str, Any]] = []

        for step in self.steps:
            current_df, summary = step.execute(current_df)
            step_summaries.append(summary)

        final_rows = int(len(current_df))
        final_cols = int(len(current_df.columns))

        pipeline_summary = {
            "initial_shape": {"rows": initial_rows, "columns": initial_cols},
            "final_shape": {"rows": final_rows, "columns": final_cols},
            "rows_removed_total": initial_rows - final_rows,
            "columns_removed_total": initial_cols - final_cols,
            "steps_executed": step_summaries,
        }

        return current_df, pipeline_summary
