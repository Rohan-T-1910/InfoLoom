import numpy as np
import pandas as pd
import pytest

from app.cleaning.pipeline import CleaningPipeline
from app.cleaning.steps.deduplication import DeduplicationStep
from app.cleaning.steps.imputation import MissingValueImputationStep
from app.cleaning.steps.outliers import OutlierHandlingStep
from app.cleaning.steps.type_coercion import TypeCoercionStep
from app.services.validation_service import validation_service

def test_deduplication_step():
    df = pd.DataFrame({
        "id": [1, 2, 2, 3],
        "name": ["A", "B", "B", "C"]
    })
    step = DeduplicationStep(keep="first")
    df_clean, summary = step.execute(df)
    assert len(df_clean) == 3
    assert summary["duplicates_removed"] == 1
    assert summary["rows_before"] == 4
    assert summary["rows_after"] == 3

def test_type_coercion_step():
    df = pd.DataFrame({
        "salary": ["$50,000", "$65,000.50", " $70,000 "],
        "is_active": ["true", "false", "yes"],
        "age": [" 25 ", " 30 ", " 35 "],
        "category": [" Tech ", " Finance ", " Tech "]
    })
    step = TypeCoercionStep()
    df_clean, summary = step.execute(df)

    assert pd.api.types.is_numeric_dtype(df_clean["salary"])
    assert pd.api.types.is_bool_dtype(df_clean["is_active"])
    assert pd.api.types.is_numeric_dtype(df_clean["age"])
    assert df_clean["category"].iloc[0] == "Tech"
    assert summary["columns_coerced_count"] >= 3

def test_imputation_median_strategy():
    # 1, 2, 3, 100 -> median is 2.5
    df = pd.DataFrame({
        "val": [1.0, 2.0, np.nan, 3.0, 100.0],
        "category": ["A", "B", np.nan, "A", "A"]
    })
    step = MissingValueImputationStep(numeric_strategy="median", categorical_strategy="mode")
    df_clean, summary = step.execute(df)

    assert df_clean["val"].isna().sum() == 0
    # Median of [1, 2, 3, 100] is 2.5
    assert df_clean["val"].iloc[2] == 2.5
    assert df_clean["category"].iloc[2] == "A"
    assert summary["imputed_columns"]["val"]["imputed_count"] == 1

def test_imputation_mean_strategy():
    df = pd.DataFrame({
        "val": [10.0, 20.0, np.nan, 30.0]
    })
    step = MissingValueImputationStep(numeric_strategy="mean")
    df_clean, summary = step.execute(df)
    # Mean of 10, 20, 30 is 20.0
    assert df_clean["val"].iloc[2] == 20.0

def test_imputation_drop_threshold():
    df = pd.DataFrame({
        "good_col": [1, 2, 3, 4],
        "mostly_empty": [1, np.nan, np.nan, np.nan]  # 75% missing
    })
    step = MissingValueImputationStep(drop_column_threshold=0.70)
    df_clean, summary = step.execute(df)
    assert "mostly_empty" not in df_clean.columns
    assert "mostly_empty" in summary["dropped_columns"]

def test_outlier_clipping_iqr():
    # Values: 10, 11, 12, 10, 11, 12, 1000 (extreme outlier)
    df = pd.DataFrame({
        "val": [10.0, 11.0, 12.0, 10.0, 11.0, 12.0, 1000.0]
    })
    step = OutlierHandlingStep(strategy="clip", method="iqr", iqr_multiplier=1.5)
    df_clean, summary = step.execute(df)

    max_clean = df_clean["val"].max()
    assert max_clean < 50.0  # Clipped down from 1000.0
    assert summary["columns_handled"]["val"]["values_clipped"] == 1

def test_outlier_removal_zscore():
    data = [10.0] * 30 + [1000.0]  # Strong outlier
    df = pd.DataFrame({"val": data})
    step = OutlierHandlingStep(strategy="remove", method="zscore", zscore_threshold=3.0)
    df_clean, summary = step.execute(df)

    assert len(df_clean) == 30
    assert summary["rows_dropped"] == 1

def test_full_pipeline_execution():
    df = pd.DataFrame({
        "id": [1, 2, 2, 3, 4],
        "revenue": ["$100", "$200", "$200", None, "$10,000"],
        "region": [" North ", " South ", " South ", " West ", " North "]
    })

    pipeline = CleaningPipeline.create_default_pipeline(
        dedup_keep="first",
        numeric_impute_strategy="median",
        outlier_strategy="clip",
    )
    df_clean, summary = pipeline.run(df)

    assert summary["initial_shape"]["rows"] == 5
    assert summary["final_shape"]["rows"] == 4  # 1 duplicate dropped
    assert df_clean["revenue"].isna().sum() == 0
    assert df_clean["region"].iloc[0] == "North"

def test_validation_service_profiling():
    df = pd.DataFrame({
        "age": [20, 25, 30, 35, 120, np.nan],
        "dept": ["HR", "IT", "IT", "HR", "Sales", "IT"],
        "salary": [50000, 60000, 70000, 80000, 90000, 100000],
    })
    # Add duplicate row
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)

    report = validation_service.validate_dataframe(df)

    assert report["total_rows"] == 7
    assert report["total_columns"] == 3
    assert report["duplicates"]["count"] == 1
    assert "age" in report["missing_values"]["columns"]
    assert report["missing_values"]["columns"]["age"]["missing_count"] == 1
    assert "age" in report["outliers"]
    assert "iqr_method" in report["outliers"]["age"]
    assert "zscore_method" in report["outliers"]["age"]
    assert report["columns_profile"]["dept"]["top_value"] in ["HR", "IT"]
    assert report["columns_profile"]["dept"]["top_frequency"] == 3

