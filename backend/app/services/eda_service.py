import math
import os
from pathlib import Path
from typing import Any, Optional
from fastapi import HTTPException, status
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, r2_score

from app.models.dataset import Dataset
from app.models.eda_report import EDAReport
from app.repositories.dataset_repository import dataset_repository
from app.repositories.eda_repository import eda_repository
from app.schemas.eda import (
    ColumnDistribution,
    CorrelationMatrixResponse,
    CorrelationPair,
    DatasetKPIs,
    DistributionBin,
    EDAResponse,
    FeatureImportanceItem,
    FeatureImportanceResponse,
)
from app.services.column_classifier import column_classifier
from app.services.validation_service import validation_service


class EDAService:
    """
    Engineered Exploratory Data Analysis (EDA) engine:
    - Overall dataset KPIs & memory profiling
    - Parametric and non-parametric summary statistics
    - Pearson correlation matrix with collinearity warning signals
    - Univariate distributions (numerical histograms & categorical frequencies)
    - Baseline ML feature importance engine (Random Forest baseline)
    - Multi-tenant response caching with selective invalidation
    """

    def _sanitize(self, val: Any) -> Any:
        """Sanitizes floats/numpy types for standard JSON serialization."""
        if val is None:
            return None
        if isinstance(val, (np.integer, int)):
            return int(val)
        if isinstance(val, (np.floating, float)):
            if math.isnan(val) or math.isinf(val):
                return None
            return float(round(val, 4))
        if isinstance(val, (np.bool_, bool)):
            return bool(val)
        if isinstance(val, (pd.Timestamp, np.datetime64)):
            return str(val)
        return val

    def _format_bytes(self, size_bytes: int) -> str:
        """Converts raw byte count into human readable units."""
        if size_bytes <= 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB"]
        i = int(math.floor(math.log(size_bytes, 1024)))
        i = min(i, len(units) - 1)
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {units[i]}"

    def compute_kpis(self, df: pd.DataFrame) -> dict[str, Any]:
        """Calculates global dataset health and structural KPIs."""
        row_count = int(len(df))
        column_count = int(len(df.columns))
        total_cells = row_count * column_count

        missing_cells = int(df.isna().sum().sum())
        missing_pct = round((missing_cells / total_cells) * 100, 2) if total_cells > 0 else 0.0

        duplicate_rows = int(df.duplicated().sum()) if row_count > 0 else 0
        duplicate_pct = round((duplicate_rows / row_count) * 100, 2) if row_count > 0 else 0.0

        numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        categorical_cols = [c for c in df.columns if c not in numeric_cols]

        memory_bytes = int(df.memory_usage(deep=True).sum())
        memory_human = self._format_bytes(memory_bytes)

        return {
            "row_count": row_count,
            "column_count": column_count,
            "total_cells": total_cells,
            "missing_cells": missing_cells,
            "missing_percentage": missing_pct,
            "duplicate_rows": duplicate_rows,
            "duplicate_percentage": duplicate_pct,
            "numeric_columns_count": len(numeric_cols),
            "categorical_columns_count": len(categorical_cols),
            "memory_bytes": memory_bytes,
            "memory_human": memory_human,
        }

    def compute_summary_statistics(self, df: pd.DataFrame) -> dict[str, Any]:
        """
        Calculates column-level statistical characteristics:
        - Numerical: mean, std, percentiles (25%, median, 75%), min, max, IQR, skewness, kurtosis, zero ratios
        - Categorical: distinct count, mode, mode frequency, top 10 categories
        """
        stats: dict[str, Any] = {}
        total_rows = len(df)

        for col in df.columns:
            series = df[col]
            missing_count = int(series.isna().sum())
            missing_pct = round((missing_count / total_rows) * 100, 2) if total_rows > 0 else 0.0
            valid_count = total_rows - missing_count

            if pd.api.types.is_numeric_dtype(series):
                clean_series = series.dropna()
                if len(clean_series) > 0:
                    mean_val = float(clean_series.mean())
                    std_val = float(clean_series.std()) if len(clean_series) > 1 else 0.0
                    min_val = float(clean_series.min())
                    q25 = float(clean_series.quantile(0.25))
                    median_val = float(clean_series.median())
                    q75 = float(clean_series.quantile(0.75))
                    max_val = float(clean_series.max())
                    iqr_val = float(q75 - q25)
                    skew_val = float(clean_series.skew()) if len(clean_series) > 2 else 0.0
                    kurt_val = float(clean_series.kurt()) if len(clean_series) > 3 else 0.0
                    zeros_cnt = int((clean_series == 0).sum())
                    zeros_pct = round((zeros_cnt / valid_count) * 100, 2) if valid_count > 0 else 0.0
                else:
                    mean_val = std_val = min_val = q25 = median_val = q75 = max_val = iqr_val = skew_val = kurt_val = None
                    zeros_cnt = 0
                    zeros_pct = 0.0

                stats[col] = {
                    "data_type": "numeric",
                    "count": valid_count,
                    "missing_count": missing_count,
                    "missing_percentage": missing_pct,
                    "mean": self._sanitize(mean_val),
                    "std": self._sanitize(std_val),
                    "min": self._sanitize(min_val),
                    "q25": self._sanitize(q25),
                    "median": self._sanitize(median_val),
                    "q75": self._sanitize(q75),
                    "max": self._sanitize(max_val),
                    "iqr": self._sanitize(iqr_val),
                    "skewness": self._sanitize(skew_val),
                    "kurtosis": self._sanitize(kurt_val),
                    "zeros_count": zeros_cnt,
                    "zeros_percentage": zeros_pct,
                }
            else:
                clean_series = series.dropna().astype(str)
                unique_cnt = int(clean_series.nunique())
                if len(clean_series) > 0:
                    vc = clean_series.value_counts()
                    mode_val = str(vc.index[0])
                    mode_freq = int(vc.iloc[0])
                    top_cats = [
                        {
                            "category": str(cat),
                            "count": int(cnt),
                            "percentage": round((cnt / valid_count) * 100, 2) if valid_count > 0 else 0.0,
                        }
                        for cat, cnt in vc.head(10).items()
                    ]
                else:
                    mode_val = None
                    mode_freq = 0
                    top_cats = []

                stats[col] = {
                    "data_type": "categorical",
                    "count": valid_count,
                    "missing_count": missing_count,
                    "missing_percentage": missing_pct,
                    "unique": unique_cnt,
                    "mode": mode_val,
                    "mode_frequency": mode_freq,
                    "top_categories": top_cats,
                }

        return stats

    def compute_correlation_matrix(self, df: pd.DataFrame) -> dict[str, Any]:
        """
        Calculates Pearson correlation matrix for numeric business measures,
        highlights meaningful relationships, and warns against redundant information overlap.
        Excludes technical identifiers and key columns from correlation analysis.
        """
        numeric_cols = [
            c for c in df.columns
            if pd.api.types.is_numeric_dtype(df[c]) and not column_classifier.is_identifier(c, df[c])
        ]

        if len(numeric_cols) < 2:
            return {
                "columns": numeric_cols,
                "matrix": {},
                "strong_correlations": [],
                "warnings": ["At least two numeric business fields are required to analyze relationships between factors."],
            }

        corr_df = df[numeric_cols].corr(method="pearson")
        matrix_dict: dict[str, dict[str, Optional[float]]] = {}
        strong_pairs: list[dict[str, Any]] = []
        warnings: list[str] = []

        seen_pairs: set[tuple[str, str]] = set()

        for c1 in numeric_cols:
            matrix_dict[c1] = {}
            for c2 in numeric_cols:
                raw_val = corr_df.loc[c1, c2]
                val = self._sanitize(raw_val)
                matrix_dict[c1][c2] = val

                if c1 != c2 and val is not None:
                    pair_key = tuple(sorted([c1, c2]))
                    if pair_key not in seen_pairs:
                        seen_pairs.add(pair_key)
                        abs_corr = abs(val)
                        if abs_corr >= 0.65:
                            if val >= 0.8:
                                rel = "Strong positive correlation"
                            elif val >= 0.65:
                                rel = "Moderate positive correlation"
                            elif val <= -0.8:
                                rel = "Strong negative correlation"
                            else:
                                rel = "Moderate negative correlation"

                            strong_pairs.append({
                                "feature_a": c1,
                                "feature_b": c2,
                                "correlation": round(val, 4),
                                "abs_correlation": round(abs_corr, 4),
                                "relationship": rel,
                            })

                            if abs_corr >= 0.90:
                                warnings.append(
                                    f"High information overlap detected between '{c1}' and '{c2}' (r={round(val, 3)}). "
                                    f"Both fields track nearly identical patterns; consider using only one to avoid redundant weighting."
                                )

        strong_pairs.sort(key=lambda x: x["abs_correlation"], reverse=True)

        return {
            "columns": numeric_cols,
            "matrix": matrix_dict,
            "strong_correlations": strong_pairs,
            "warnings": warnings,
        }

    def compute_distributions(self, df: pd.DataFrame) -> dict[str, Any]:
        """
        Builds distribution histograms for numeric columns and
        frequency bar buckets for categorical columns.
        """
        distributions: dict[str, Any] = {}

        for col in df.columns:
            series = df[col].dropna()
            if len(series) == 0:
                distributions[col] = {
                    "column_name": col,
                    "data_type": "empty",
                    "bins": [],
                    "summary": {"count": 0},
                }
                continue

            if pd.api.types.is_numeric_dtype(series):
                min_v = float(series.min())
                max_v = float(series.max())
                total_valid = len(series)

                if min_v == max_v:
                    bins = [{
                        "bin_start": min_v,
                        "bin_end": max_v,
                        "label": f"{min_v}",
                        "count": total_valid,
                        "percentage": 100.0,
                    }]
                else:
                    num_bins = 10 if total_valid >= 50 else min(7, max(3, int(math.sqrt(total_valid))))
                    counts, bin_edges = np.histogram(series, bins=num_bins)
                    bins = []
                    for i in range(len(counts)):
                        b_start = float(round(bin_edges[i], 2))
                        b_end = float(round(bin_edges[i + 1], 2))
                        cnt = int(counts[i])
                        pct = round((cnt / total_valid) * 100, 2)
                        bins.append({
                            "bin_start": b_start,
                            "bin_end": b_end,
                            "label": f"{b_start} - {b_end}",
                            "count": cnt,
                            "percentage": pct,
                        })

                distributions[col] = {
                    "column_name": col,
                    "data_type": "numeric",
                    "bins": bins,
                    "summary": {
                        "count": total_valid,
                        "min": self._sanitize(min_v),
                        "max": self._sanitize(max_v),
                        "mean": self._sanitize(float(series.mean())),
                        "median": self._sanitize(float(series.median())),
                    },
                }
            else:
                str_series = series.astype(str)
                total_valid = len(str_series)
                vc = str_series.value_counts()
                top_vc = vc.head(12)
                other_count = int(vc.iloc[12:].sum()) if len(vc) > 12 else 0

                bins = [
                    {
                        "bin_start": None,
                        "bin_end": None,
                        "label": str(cat),
                        "count": int(cnt),
                        "percentage": round((cnt / total_valid) * 100, 2) if total_valid > 0 else 0.0,
                    }
                    for cat, cnt in top_vc.items()
                ]

                if other_count > 0:
                    bins.append({
                        "bin_start": None,
                        "bin_end": None,
                        "label": "Other categories",
                        "count": other_count,
                        "percentage": round((other_count / total_valid) * 100, 2) if total_valid > 0 else 0.0,
                    })

                distributions[col] = {
                    "column_name": col,
                    "data_type": "categorical",
                    "bins": bins,
                    "summary": {
                        "count": total_valid,
                        "unique": int(str_series.nunique()),
                    },
                }

        return distributions

    def detect_candidate_targets(self, df: pd.DataFrame) -> list[str]:
        """Identifies promising candidate target variables for predictive analysis, excluding technical identifiers."""
        candidates: list[str] = []
        keywords = ["target", "label", "class", "churn", "survived", "price", "salary", "outcome", "status", "sale", "profit", "score", "rating"]

        for col in df.columns:
            if column_classifier.is_identifier(col, df[col]):
                continue
            c_lower = str(col).lower()
            if any(k in c_lower for k in keywords):
                candidates.append(col)

        # Append last column if not already in candidates and not an identifier
        if len(df.columns) > 1:
            last_col = df.columns[-1]
            if last_col not in candidates and not column_classifier.is_identifier(last_col, df[last_col]):
                candidates.append(last_col)

        # Append numeric or classification columns with healthy variation
        for col in df.columns:
            if col not in candidates and not column_classifier.is_identifier(col, df[col]):
                series = df[col].dropna()
                if len(series) > 10:
                    nunique = series.nunique()
                    if 2 <= nunique < len(series) * 0.95:
                        candidates.append(col)
                        if len(candidates) >= 6:
                            break

        return candidates[:6]

    def compute_feature_importance(
        self, df: pd.DataFrame, target_column: Optional[str]
    ) -> Optional[dict[str, Any]]:
        """
        Evaluates feature importances via a fast baseline Random Forest model.
        Detects classification vs regression problem type automatically.
        """
        candidate_targets = self.detect_candidate_targets(df)

        # Ensure target_column is valid and not an identifier
        if not target_column or column_classifier.is_identifier(target_column, df.get(target_column)):
            if candidate_targets:
                target_column = candidate_targets[0]
            else:
                return None

        if target_column not in df.columns or column_classifier.is_identifier(target_column, df[target_column]):
            return None

        # Prepare dataset: drop missing targets
        valid_df = df.dropna(subset=[target_column]).copy()
        if len(valid_df) < 8:
            return None

        y_raw = valid_df[target_column]

        # Determine task type: classification vs regression
        is_numeric = pd.api.types.is_numeric_dtype(y_raw)
        nunique_y = y_raw.nunique()

        if nunique_y < 2:
            return None

        if (not is_numeric) or (nunique_y <= 10 and nunique_y < len(y_raw) * 0.2):
            problem_type = "classification"
            model_used = "Random Forest Classifier (Baseline)"
            score_name = "Baseline Train Accuracy"
            # Encode categorical target
            y, _ = pd.factorize(y_raw)
            model = RandomForestClassifier(n_estimators=30, max_depth=6, random_state=42)
        else:
            problem_type = "regression"
            model_used = "Random Forest Regressor (Baseline)"
            score_name = "Baseline Train R² Score"
            y = y_raw.astype(float).values
            model = RandomForestRegressor(n_estimators=30, max_depth=6, random_state=42)

        # Feature matrix X: exclude target and any identifier columns
        feature_cols = [
            c for c in valid_df.columns
            if c != target_column and not column_classifier.is_identifier(c, valid_df[c])
        ]
        if not feature_cols:
            return None

        X_df = valid_df[feature_cols].copy()

        # Preprocess features: impute and encode
        clean_features = []
        feature_name_mapping: list[str] = []

        for col in feature_cols:
            col_series = X_df[col]
            if pd.api.types.is_numeric_dtype(col_series):
                med = col_series.median()
                fill_val = med if pd.notnull(med) else 0.0
                arr = col_series.fillna(fill_val).values
                clean_features.append(arr.reshape(-1, 1))
                feature_name_mapping.append(col)
            else:
                # Categorical column
                cat_series = col_series.fillna("missing").astype(str)
                codes, _ = pd.factorize(cat_series)
                clean_features.append(codes.reshape(-1, 1))
                feature_name_mapping.append(col)

        if not clean_features:
            return None

        X = np.hstack(clean_features)

        try:
            model.fit(X, y)
            importances = model.feature_importances_

            # Compute metric
            y_pred = model.predict(X)
            if problem_type == "classification":
                score = float(accuracy_score(y, y_pred))
            else:
                score = float(max(-1.0, r2_score(y, y_pred)))

            # Assemble items
            total_imp = float(np.sum(importances))
            ranked_items: list[dict[str, Any]] = []

            for col_name, imp in zip(feature_name_mapping, importances):
                imp_val = float(imp)
                pct = round((imp_val / total_imp) * 100, 2) if total_imp > 0 else 0.0
                ranked_items.append({
                    "feature": col_name,
                    "importance": round(imp_val, 4),
                    "percentage": pct,
                })

            ranked_items.sort(key=lambda x: x["importance"], reverse=True)
            for idx, item in enumerate(ranked_items):
                item["rank"] = idx + 1

            return {
                "target_column": target_column,
                "problem_type": problem_type,
                "model_used": model_used,
                "baseline_score_name": score_name,
                "baseline_score": self._sanitize(score),
                "features": ranked_items,
                "candidate_targets": candidate_targets,
            }
        except Exception:
            return None

    def run_eda(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        target_column: Optional[str] = None,
        use_cleaned: bool = True,
        force_refresh: bool = False,
    ) -> EDAResponse:
        """
        Orchestrates full EDA workflow:
        Checks persistent caching, evaluates KPIs, statistics, correlations,
        distributions, and feature importances.
        """
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found.",
            )

        # Determine target file (cleaned if available and requested, else raw)
        is_cleaned = bool(use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
        file_path = dataset.cleaned_file_path if is_cleaned else dataset.file_path

        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset source file does not exist on disk.",
            )

        # 1. Caching check
        if not force_refresh:
            cached_report = eda_repository.get_latest_cached(
                db=db,
                dataset_id=dataset_id,
                user_id=user_id,
                is_cleaned=is_cleaned,
                target_column=target_column,
            )
            if cached_report:
                # Check if cached report contains identifier columns or stale collinearity jargon
                cached_corr = cached_report.correlation_matrix or {}
                cached_cols = cached_corr.get("columns", [])
                cached_warnings = cached_corr.get("warnings", [])
                has_stale_identifiers = any(
                    column_classifier.is_identifier(c) for c in cached_cols
                ) or any(
                    "collinearity" in str(w).lower() for w in cached_warnings
                )

                if not has_stale_identifiers:
                    return EDAResponse(
                        id=cached_report.id,
                        dataset_id=cached_report.dataset_id,
                        is_cleaned=cached_report.is_cleaned,
                        target_column=cached_report.target_column,
                        kpis=cached_report.kpis,
                        summary_statistics=cached_report.summary_statistics,
                        correlation_matrix=cached_report.correlation_matrix,
                        distributions=cached_report.distributions,
                        feature_importance=cached_report.feature_importance,
                        cached=True,
                        created_at=cached_report.created_at,
                    )
                else:
                    # Invalidate stale cached report with technical identifiers/jargon
                    try:
                        db.delete(cached_report)
                        db.commit()
                    except Exception:
                        db.rollback()

        # 2. Read dataset
        df = validation_service.read_dataset_df(file_path)

        # 3. Compute sections
        kpis = self.compute_kpis(df)
        summary_statistics = self.compute_summary_statistics(df)
        correlation_matrix = self.compute_correlation_matrix(df)
        distributions = self.compute_distributions(df)
        feature_importance = self.compute_feature_importance(df, target_column=target_column)

        actual_target = feature_importance["target_column"] if feature_importance else target_column

        # 4. Persist to cache
        report = eda_repository.create(
            db=db,
            dataset_id=dataset_id,
            user_id=user_id,
            is_cleaned=is_cleaned,
            target_column=actual_target,
            kpis=kpis,
            summary_statistics=summary_statistics,
            correlation_matrix=correlation_matrix,
            distributions=distributions,
            feature_importance=feature_importance,
        )

        return EDAResponse(
            id=report.id,
            dataset_id=report.dataset_id,
            is_cleaned=report.is_cleaned,
            target_column=report.target_column,
            kpis=kpis,
            summary_statistics=summary_statistics,
            correlation_matrix=correlation_matrix,
            distributions=distributions,
            feature_importance=feature_importance,
            cached=False,
            created_at=report.created_at,
        )


eda_service = EDAService()
