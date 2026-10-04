from dataclasses import dataclass
from datetime import datetime
import logging
import math
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.models.anomaly import AnomalyModel
from app.models.dataset import Dataset
from app.models.forecasting import ForecastModel
from app.models.insight import InsightReport
from app.models.ml import MLModel
from app.repositories.insight_repository import insight_repository
from app.schemas.insight import (
    InsightCategory,
    InsightDirection,
    InsightGenerateRequest,
    InsightKPISummary,
    InsightReportResponse,
    InsightSeverity,
    InsightSummaryResponse,
    StructuredInsightFact,
)
from app.services.column_classifier import column_classifier
from app.services.llm_polisher import llm_polisher

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class InsightConfig:
    """
    Explicit, centralized, and reproducible analytical threshold configuration.
    Eliminates scattered magic numbers.
    """
    min_rows_required: int = 5
    pct_change_threshold: float = 15.0  # Minimum % change to trigger insight
    pct_change_high_threshold: float = 35.0  # Significant % change threshold
    top_contributor_threshold: float = 35.0  # % share for categorical dominance
    pareto_concentration_threshold: float = 70.0  # % of total sum in top 20%
    correlation_threshold: float = 0.65  # Pearson correlation magnitude |r|
    skewness_threshold: float = 1.5  # |skew| for distribution asymmetry
    zero_inflation_threshold: float = 25.0  # % exact zeros for zero-inflation
    anomaly_rate_warning_threshold: float = 4.0  # % anomalies considered elevated
    trend_min_r2: float = 0.25  # Minimum R² goodness-of-fit for linear trend
    trend_min_slope_std_ratio: float = 0.03  # Minimum slope relative to std

DEFAULT_CONFIG = InsightConfig()

class BusinessInsightsService:
    """
    Deterministic business insights engine.
    
    Transforms multi-phase analytical outputs (EDA, cleaning, time series,
    anomalies, supervised ML, statistical distributions) into structured,
    explainable facts and human-readable NLG explanations.
    """

    def __init__(self, config: InsightConfig = DEFAULT_CONFIG):
        self.config = config

    def get_or_generate_insights(
        self,
        db: Session,
        dataset: Dataset,
        user_id: int,
        refresh: bool = False,
        include_llm: bool = False,
        category: Optional[str] = None,
        min_severity: Optional[str] = None,
    ) -> InsightReportResponse:
        """
        Retrieves cached insight report or triggers deterministic generation
        if not present or refresh is requested.
        """
        if not refresh:
            cached = insight_repository.get_latest_by_dataset_and_user(
                db=db, dataset_id=dataset.id, user_id=user_id
            )
            if cached:
                # Check if cached report contains any identifier columns (e.g. Transaction ID)
                has_identifier = any(
                    column_classifier.is_identifier(item.get("feature", ""))
                    or column_classifier.is_identifier(item.get("secondary_feature", ""))
                    for item in (cached.insights or [])
                )
                if has_identifier:
                    logger.info(f"Cached report #{cached.id} contains identifier features. Regenerating clean report...")
                    return self.generate_insights(
                        db=db,
                        dataset=dataset,
                        user_id=user_id,
                        request=InsightGenerateRequest(
                            use_cleaned=dataset.has_cleaned,
                            include_llm=include_llm,
                        ),
                        category=category,
                        min_severity=min_severity,
                    )
                return self._filter_report(cached, category=category, min_severity=min_severity)

        # Generate fresh deterministic report
        return self.generate_insights(
            db=db,
            dataset=dataset,
            user_id=user_id,
            request=InsightGenerateRequest(
                use_cleaned=dataset.has_cleaned,
                include_llm=include_llm,
            ),
            category=category,
            min_severity=min_severity,
        )

    def generate_insights(
        self,
        db: Session,
        dataset: Dataset,
        user_id: int,
        request: InsightGenerateRequest,
        category: Optional[str] = None,
        min_severity: Optional[str] = None,
    ) -> InsightReportResponse:
        """
        Executes end-to-end deterministic insight discovery, rule evaluation,
        NLG template rendering, prioritization, and optional LLM polishing.
        """
        # 1. Load dataset DataFrame
        df = self._load_dataframe(dataset, use_cleaned=request.use_cleaned)
        
        # 2. Extract facts from each analytical engine
        facts: List[StructuredInsightFact] = []

        if df is not None and len(df) >= self.config.min_rows_required:
            classified = column_classifier.classify_columns(df)
            # Strictly exclude identifier columns from analytical features
            numeric_cols = [
                c for c in classified["numeric_measures"]
                if not column_classifier.is_identifier(c, df[c])
            ]
            categorical_cols = [
                c for c in classified["categoricals"]
                if not column_classifier.is_identifier(c, df[c])
            ]

            # Prioritize core business metrics: Sales, Revenue, Total Amount, Quantity, Price, Profit, Cost
            def business_priority(col_name: str) -> int:
                name_lower = col_name.lower()
                if re.search(r"(sales|revenue|amount|total|profit|margin|income)", name_lower):
                    return 0
                if re.search(r"(price|cost|expense|spend|fee)", name_lower):
                    return 1
                if re.search(r"(quantity|qty|volume|units|count)", name_lower):
                    return 2
                return 3

            numeric_cols.sort(key=business_priority)

            # Rule 1: Percentage Changes
            facts.extend(self._extract_percentage_changes(df, numeric_cols, request.pct_change_threshold or self.config.pct_change_threshold))

            # Rule 2: Top Contributors & Pareto Concentration
            facts.extend(self._extract_top_contributors(df, categorical_cols, numeric_cols))

            # Rule 3: Trend Direction
            facts.extend(self._extract_trends(df, numeric_cols))

            # Rule 4: Distribution Observations
            facts.extend(self._extract_distribution_observations(df, numeric_cols))

            # Rule 5: Correlation Observations
            facts.extend(self._extract_correlation_observations(df, numeric_cols))

            # Rule 6: Data Quality Observations
            facts.extend(self._extract_data_quality_observations(df))

        # Rule 7: Forecasting Trajectory (Phase 6 model)
        facts.extend(self._extract_forecasting_insights(db, dataset.id, user_id))

        # Rule 8: Anomaly Diagnostics (Phase 7 model)
        facts.extend(self._extract_anomaly_insights(db, dataset.id, user_id))

        # Rule 9: Supervised ML Performance (Phase 4 model)
        facts.extend(self._extract_ml_insights(db, dataset.id, user_id))

        # 3. Deduplication and Prioritization
        prioritized_facts = self._deduplicate_and_prioritize(facts)

        # 4. Optional LLM Polish (preserves 100% of facts)
        if request.include_llm:
            prioritized_facts = llm_polisher.polish_all(prioritized_facts)

        # 5. Build KPI Summary
        kpi_summary = self._compute_kpi_summary(prioritized_facts)
        categories = sorted(list(set(f.category for f in prioritized_facts)))

        # 6. Build Title & Summary
        title = f"Business Insights: {dataset.original_filename}"
        summary = (
            f"Generated {len(prioritized_facts)} deterministic insights covering {len(categories)} operational dimensions "
            f"({kpi_summary.critical_count} critical, {kpi_summary.warning_count} warnings, {kpi_summary.positive_count} positive signals)."
        )

        # 7. Persist Report
        persisted = insight_repository.create(
            db=db,
            dataset_id=dataset.id,
            user_id=user_id,
            title=title,
            summary=summary,
            insights=[f.model_dump() for f in prioritized_facts],
            categories=categories,
            kpi_summary=kpi_summary.model_dump(),
            is_cleaned=request.use_cleaned,
            llm_polished=request.include_llm and any(f.is_llm_polished for f in prioritized_facts),
        )

        return self._filter_report(persisted, category=category, min_severity=min_severity)

    def get_summary(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> InsightSummaryResponse:
        """Returns compact summary of latest insights for dashboard widgets."""
        report = insight_repository.get_latest_by_dataset_and_user(
            db=db, dataset_id=dataset_id, user_id=user_id
        )
        if not report:
            return InsightSummaryResponse(
                dataset_id=dataset_id,
                has_report=False,
                total_insights=0,
                kpi_summary=None,
                top_insights=[],
                created_at=None,
            )

        valid_items = [
            item for item in (report.insights or [])
            if not column_classifier.is_identifier(item.get("feature", ""))
            and not column_classifier.is_identifier(item.get("secondary_feature", ""))
        ]
        parsed_insights = [StructuredInsightFact(**item) for item in valid_items[:5]]
        kpi = InsightKPISummary(**report.kpi_summary)

        return InsightSummaryResponse(
            dataset_id=dataset_id,
            has_report=True,
            total_insights=len(valid_items),
            kpi_summary=kpi,
            top_insights=parsed_insights,
            created_at=report.created_at,
        )

    # =========================================================================
    # Deterministic Rule Extractors
    # =========================================================================

    def _extract_percentage_changes(
        self,
        df: pd.DataFrame,
        numeric_cols: List[str],
        threshold: float,
    ) -> List[StructuredInsightFact]:
        """
        Compares first half of chronological observations against second half.
        Handles zero comparison baseline safely.
        """
        facts: List[StructuredInsightFact] = []
        n = len(df)
        if n < 6 or not numeric_cols:
            return facts

        mid = n // 2
        first_half = df.iloc[:mid]
        second_half = df.iloc[mid:]

        for col in numeric_cols[:10]:  # Evaluate top 10 numeric features
            if column_classifier.is_identifier(col, df[col]):
                continue
            m1 = float(first_half[col].dropna().mean()) if len(first_half[col].dropna()) > 0 else 0.0
            m2 = float(second_half[col].dropna().mean()) if len(second_half[col].dropna()) > 0 else 0.0

            # Safe zero-baseline handling
            if abs(m1) < 1e-9:
                if abs(m2) > 1e-9:
                    diff = m2 - m1
                    facts.append(
                        StructuredInsightFact(
                            id=f"pct_change_{col}_from_zero",
                            category=InsightCategory.PERCENTAGE_CHANGE.value,
                            title=f"New Activity Detected in '{col}'",
                            severity=InsightSeverity.INFO.value,
                            direction=InsightDirection.UPWARD.value,
                            feature=col,
                            current_value=round(m2, 2),
                            comparison_value=round(m1, 2),
                            change_pct=None,
                            change_abs=round(diff, 2),
                            confidence=0.85,
                            explanation=(
                                f"Average '{col}' shifted from a zero baseline (0.00) to {m2:.2f} "
                                f"in the latter half of the dataset (absolute change of +{diff:.2f}). "
                                f"Why it matters: Indicates a newly active operational metric that was previously dormant. "
                                f"Recommended Next Step: Confirm operational events or product launches that triggered this activation."
                            ),
                            supporting_evidence={
                                "baseline_mean": 0.0,
                                "comparison_mean": round(m2, 4),
                                "absolute_change": round(diff, 4),
                                "first_half_samples": mid,
                                "second_half_samples": n - mid,
                            },
                        )
                    )
                continue

            pct_change = ((m2 - m1) / abs(m1)) * 100.0

            if abs(pct_change) >= threshold:
                direction = InsightDirection.UPWARD.value if pct_change > 0 else InsightDirection.DOWNWARD.value
                
                # Determine severity
                if pct_change >= self.config.pct_change_high_threshold:
                    severity = InsightSeverity.POSITIVE.value
                elif pct_change <= -self.config.pct_change_high_threshold:
                    severity = InsightSeverity.CRITICAL.value
                elif pct_change < 0:
                    severity = InsightSeverity.WARNING.value
                else:
                    severity = InsightSeverity.INFO.value

                verb = "increased" if pct_change > 0 else "decreased"
                sign = "+" if pct_change > 0 else ""

                impact_desc = "strong performance expansion" if pct_change > 0 else "performance contraction requiring attention"
                next_step_desc = (
                    f"Investigate high-performing segments to sustain positive momentum in '{col}'."
                    if pct_change > 0
                    else f"Examine root causes and underlying segments driving the decline in '{col}'."
                )

                facts.append(
                    StructuredInsightFact(
                        id=f"pct_change_{col}_{direction}",
                        category=InsightCategory.PERCENTAGE_CHANGE.value,
                        title=f"{col.replace('_', ' ').title()} {verb.capitalize()} by {abs(pct_change):.1f}%",
                        severity=severity,
                        direction=direction,
                        feature=col,
                        current_value=round(m2, 2),
                        comparison_value=round(m1, 2),
                        change_pct=round(pct_change, 2),
                        change_abs=round(m2 - m1, 2),
                        confidence=min(0.95, 0.70 + (abs(pct_change) / 200.0)),
                        explanation=(
                            f"Average '{col}' {verb} by {abs(pct_change):.1f}% "
                            f"(from {m1:.2f} to {m2:.2f}, net change of {sign}{m2 - m1:.2f}) "
                            f"comparing the first {mid} observations to the subsequent {n - mid} periods. "
                            f"Why it matters: Represents a notable {impact_desc} over time. "
                            f"Recommended Next Step: {next_step_desc}"
                        ),
                        supporting_evidence={
                            "baseline_period_mean": round(m1, 4),
                            "current_period_mean": round(m2, 4),
                            "percentage_change": round(pct_change, 2),
                            "absolute_difference": round(m2 - m1, 4),
                            "sample_size": n,
                        },
                    )
                )

        return facts

    def _extract_top_contributors(
        self,
        df: pd.DataFrame,
        categorical_cols: List[str],
        numeric_cols: List[str],
    ) -> List[StructuredInsightFact]:
        """
        Identifies single-category dominance and Pareto (80/20) volume concentration.
        """
        facts: List[StructuredInsightFact] = []
        n = len(df)

        # 1. Categorical Frequency Dominance
        for col in categorical_cols[:6]:
            counts = df[col].value_counts(dropna=True)
            if len(counts) > 1:
                top_cat = str(counts.index[0])
                top_count = int(counts.iloc[0])
                share = (top_count / n) * 100.0

                if share >= self.config.top_contributor_threshold:
                    severity = InsightSeverity.WARNING.value if share >= 60.0 else InsightSeverity.INFO.value
                    facts.append(
                        StructuredInsightFact(
                            id=f"top_contributor_{col}_{top_cat}",
                            category=InsightCategory.TOP_CONTRIBUTOR.value,
                            title=f"High Concentration: '{top_cat}' Dominates '{col}'",
                            severity=severity,
                            direction=InsightDirection.CONCENTRATED.value,
                            feature=col,
                            current_value=round(share, 1),
                            comparison_value=100.0 / len(counts),
                            change_pct=None,
                            change_abs=None,
                            confidence=round(min(0.99, share / 100.0 + 0.1), 2),
                            explanation=(
                                f"What happened: Category '{top_cat}' is the dominant contributor in '{col}', "
                                f"accounting for {share:.1f}% of all records ({top_count:,} of {n:,} rows), "
                                f"surpassing the uniform expectation of {100.0 / len(counts):.1f}%. "
                                f"Why it matters: High categorical concentration creates commercial reliance on a single segment. "
                                f"Recommended Next Step: Evaluate whether to reinforce dominance in '{top_cat}' or diversify outreach across secondary categories."
                            ),
                            supporting_evidence={
                                "dominant_category": top_cat,
                                "count": top_count,
                                "total_records": n,
                                "share_percentage": round(share, 2),
                                "distinct_categories": len(counts),
                            },
                        )
                    )

        # 2. Pareto Numeric Concentration (Sum in top 20% records)
        for col in numeric_cols[:6]:
            series = df[col].dropna()
            if len(series) >= 10 and series.sum() > 0 and (series >= 0).all():
                sorted_vals = series.sort_values(ascending=False).values
                top_20_count = max(1, int(len(sorted_vals) * 0.2))
                top_20_sum = float(sorted_vals[:top_20_count].sum())
                total_sum = float(sorted_vals.sum())
                concentration_share = (top_20_sum / total_sum) * 100.0

                if concentration_share >= self.config.pareto_concentration_threshold:
                    facts.append(
                        StructuredInsightFact(
                            id=f"pareto_concentration_{col}",
                            category=InsightCategory.TOP_CONTRIBUTOR.value,
                            title=f"Pareto Volume Concentration in '{col}'",
                            severity=InsightSeverity.WARNING.value if concentration_share >= 80.0 else InsightSeverity.INFO.value,
                            direction=InsightDirection.CONCENTRATED.value,
                            feature=col,
                            current_value=round(concentration_share, 1),
                            comparison_value=20.0,
                            change_pct=None,
                            change_abs=None,
                            confidence=0.92,
                            explanation=(
                                f"What happened: The top 20% of observations in '{col}' account for {concentration_share:.1f}% "
                                f"of the total cumulative volume ({top_20_sum:,.2f} of {total_sum:,.2f}). "
                                f"Why it matters: A disproportionate volume of value is generated by a minority of records, characteristic of high Pareto concentration. "
                                f"Recommended Next Step: Focus dedicated account management and service tiering on this top-performing 20% tier."
                            ),
                            supporting_evidence={
                                "top_20_percent_count": top_20_count,
                                "top_20_percent_sum": round(top_20_sum, 2),
                                "total_sum": round(total_sum, 2),
                                "concentration_percentage": round(concentration_share, 2),
                            },
                        )
                    )

        return facts

    def _extract_trends(
        self,
        df: pd.DataFrame,
        numeric_cols: List[str],
    ) -> List[StructuredInsightFact]:
        """
        Detects consistent monotonic linear trends over observation ordering.
        """
        facts: List[StructuredInsightFact] = []
        n = len(df)
        if n < 8 or not numeric_cols:
            return facts

        x = np.arange(n)
        x_mean = np.mean(x)
        x_var = np.var(x)

        for col in numeric_cols[:8]:
            y = df[col].fillna(df[col].median()).values
            y_std = float(np.std(y))
            if y_std < 1e-9:
                continue

            # Linear regression: slope = cov(x, y) / var(x)
            cov_xy = np.mean((x - x_mean) * (y - np.mean(y)))
            slope = float(cov_xy / x_var)
            intercept = float(np.mean(y) - slope * x_mean)
            
            # Compute R²
            y_pred = slope * x + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r2 = float(1 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0

            normalized_slope = abs(slope) / y_std

            if r2 >= self.config.trend_min_r2 and normalized_slope >= self.config.trend_min_slope_std_ratio:
                direction = InsightDirection.UPWARD.value if slope > 0 else InsightDirection.DOWNWARD.value
                trend_word = "upward" if slope > 0 else "downward"
                severity = InsightSeverity.POSITIVE.value if slope > 0 else InsightSeverity.WARNING.value

                total_expected_delta = slope * (n - 1)

                impact_meaning = (
                    f"Why it matters: Sustained expansion in '{col}' indicates positive momentum across operational periods."
                    if slope > 0
                    else f"Why it matters: Persistent decline in '{col}' suggests systematic downward pressure that may affect overall outcomes."
                )
                action_next = (
                    f"Recommended Next Step: Capitalize on positive growth factors and verify capacity to support continuation."
                    if slope > 0
                    else f"Recommended Next Step: Investigate contributing factors or underperforming sub-segments causing this downward trajectory."
                )

                facts.append(
                    StructuredInsightFact(
                        id=f"trend_{col}_{direction}",
                        category=InsightCategory.TREND.value,
                        title=f"Consistent {trend_word.capitalize()} Trend in '{col}'",
                        severity=severity,
                        direction=direction,
                        feature=col,
                        current_value=round(float(y[-1]), 2),
                        comparison_value=round(float(y[0]), 2),
                        change_pct=round((total_expected_delta / abs(np.mean(y))) * 100.0, 1) if abs(np.mean(y)) > 0 else None,
                        change_abs=round(total_expected_delta, 2),
                        confidence=round(min(0.98, max(0.60, r2)), 2),
                        explanation=(
                            f"What happened: '{col}' shows a statistically clear {trend_word} trajectory over the analyzed sequence "
                            f"(average change of {'+' if slope > 0 else ''}{slope:.3f} per observation, net delta of {total_expected_delta:+.2f}). "
                            f"{impact_meaning} {action_next}"
                        ),
                        supporting_evidence={
                            "r_squared": round(r2, 4),
                            "slope": round(slope, 6),
                            "intercept": round(intercept, 4),
                            "total_span_delta": round(total_expected_delta, 4),
                            "observation_count": n,
                        },
                    )
                )

        return facts

    def _extract_distribution_observations(
        self,
        df: pd.DataFrame,
        numeric_cols: List[str],
    ) -> List[StructuredInsightFact]:
        """
        Detects heavy tails, significant skewness (mean vs median divergence),
        and zero-inflation.
        """
        facts: List[StructuredInsightFact] = []
        n = len(df)
        if n < 8 or not numeric_cols:
            return facts

        for col in numeric_cols[:8]:
            series = df[col].dropna()
            if len(series) < 8 or series.nunique() <= 1:
                continue

            skew = float(series.skew())
            mean = float(series.mean())
            median = float(series.median())

            # 1. Asymmetric Skewness (Mean pulled away from Median)
            if abs(skew) >= self.config.skewness_threshold:
                direction_str = "right-skewed (positive tail)" if skew > 0 else "left-skewed (negative tail)"
                divergence_pct = ((mean - median) / abs(median)) * 100.0 if abs(median) > 1e-6 else 0.0

                facts.append(
                    StructuredInsightFact(
                        id=f"distribution_skew_{col}",
                        category=InsightCategory.DISTRIBUTION.value,
                        title=f"Asymmetric Distribution in '{col}'",
                        severity=InsightSeverity.INFO.value,
                        direction=InsightDirection.SKEWED.value,
                        feature=col,
                        current_value=round(mean, 2),
                        comparison_value=round(median, 2),
                        change_pct=round(divergence_pct, 1) if abs(median) > 1e-6 else None,
                        change_abs=round(mean - median, 2),
                        confidence=round(min(0.95, 0.70 + (abs(skew) / 10.0)), 2),
                        explanation=(
                            f"'{col}' is highly {direction_str} with skewness of {skew:.2f}. "
                            f"Extreme observations pull the parametric mean ({mean:.2f}) {divergence_pct:+.1f}% "
                            f"away from the robust median ({median:.2f}), suggesting median is a more representative central metric."
                        ),
                        supporting_evidence={
                            "skewness": round(skew, 3),
                            "mean": round(mean, 4),
                            "median": round(median, 4),
                            "divergence_percentage": round(divergence_pct, 2),
                            "sample_size": len(series),
                        },
                    )
                )

            # 2. Zero-Inflation Observation
            zero_count = int((series == 0).sum())
            zero_pct = (zero_count / len(series)) * 100.0
            if zero_pct >= self.config.zero_inflation_threshold:
                facts.append(
                    StructuredInsightFact(
                        id=f"distribution_zeros_{col}",
                        category=InsightCategory.DISTRIBUTION.value,
                        title=f"Zero-Inflation Detected in '{col}'",
                        severity=InsightSeverity.INFO.value,
                        direction=InsightDirection.NEUTRAL.value,
                        feature=col,
                        current_value=round(zero_pct, 1),
                        comparison_value=0.0,
                        change_pct=None,
                        change_abs=None,
                        confidence=0.90,
                        explanation=(
                            f"{zero_pct:.1f}% of observations in '{col}' are exactly zero ({zero_count:,} of {len(series):,} records), "
                            f"indicating a zero-inflated or thresholded activity variable."
                        ),
                        supporting_evidence={
                            "zero_count": zero_count,
                            "zero_percentage": round(zero_pct, 2),
                            "total_samples": len(series),
                        },
                    )
                )

        return facts

    def _extract_correlation_observations(
        self,
        df: pd.DataFrame,
        numeric_cols: List[str],
    ) -> List[StructuredInsightFact]:
        """
        Discovers strong linear co-movement between pairs without causal assertions.
        """
        facts: List[StructuredInsightFact] = []
        if len(numeric_cols) < 2 or len(df) < 8:
            return facts

        corr_matrix = df[numeric_cols].corr()

        visited = set()
        for i, col_a in enumerate(numeric_cols):
            for j, col_b in enumerate(numeric_cols):
                if i >= j:
                    continue
                pair_key = tuple(sorted([col_a, col_b]))
                if pair_key in visited:
                    continue
                visited.add(pair_key)

                r = float(corr_matrix.loc[col_a, col_b])
                if not math.isnan(r) and abs(r) >= self.config.correlation_threshold:
                    relation = "positive co-movement" if r > 0 else "inverse relationship"
                    direction = InsightDirection.POSITIVE.value if r > 0 else InsightDirection.NEGATIVE.value

                    facts.append(
                        StructuredInsightFact(
                            id=f"correlation_{pair_key[0]}_{pair_key[1]}",
                            category=InsightCategory.CORRELATION.value,
                            title=f"Strong Correlation: '{col_a}' ↔ '{col_b}'",
                            severity=InsightSeverity.INFO.value,
                            direction=direction,
                            feature=col_a,
                            secondary_feature=col_b,
                            current_value=round(r, 3),
                            comparison_value=0.0,
                            change_pct=None,
                            change_abs=None,
                            confidence=round(abs(r), 2),
                            explanation=(
                                f"A strong {relation} (Pearson r = {r:+.2f}) was detected between '{col_a}' and '{col_b}'. "
                                f"Both dimensions move in strong statistical alignment across the dataset. "
                                f"Note that this indicates correlation rather than confirmed direct causation."
                            ),
                            supporting_evidence={
                                "pearson_r": round(r, 4),
                                "r_squared": round(r ** 2, 4),
                                "feature_a": col_a,
                                "feature_b": col_b,
                                "sample_size": len(df),
                            },
                        )
                    )

        return facts

    def _extract_data_quality_observations(self, df: pd.DataFrame) -> List[StructuredInsightFact]:
        """Discovers dataset-wide nullity, high-missingness columns, or duplicate rows."""
        facts: List[StructuredInsightFact] = []
        n = len(df)
        if n < 5:
            return facts

        # 1. Missingness
        total_cells = df.size
        null_cells = int(df.isnull().sum().sum())
        null_pct = (null_cells / total_cells) * 100.0 if total_cells > 0 else 0.0

        if null_pct >= 5.0:
            severity = InsightSeverity.CRITICAL.value if null_pct >= 25.0 else InsightSeverity.WARNING.value
            high_null_cols = [c for c in df.columns if (df[c].isnull().sum() / n) >= 0.15]

            col_detail = f" Highest missingness in {', '.join(high_null_cols[:3])}." if high_null_cols else ""
            facts.append(
                StructuredInsightFact(
                    id="data_quality_missing_cells",
                    category=InsightCategory.DATA_QUALITY.value,
                    title="Elevated Missing Value Ratio",
                    severity=severity,
                    direction=InsightDirection.NEUTRAL.value,
                    feature="dataset_matrix",
                    current_value=round(null_pct, 1),
                    comparison_value=0.0,
                    confidence=0.95,
                    explanation=(
                        f"{null_pct:.1f}% of all cells ({null_cells:,} missing values) require imputation or handling.{col_detail}"
                    ),
                    supporting_evidence={
                        "missing_cells": null_cells,
                        "total_cells": total_cells,
                        "missing_percentage": round(null_pct, 2),
                        "high_null_columns": high_null_cols,
                    },
                )
            )

        # 2. Duplicate Rows
        duplicate_count = int(df.duplicated().sum())
        if duplicate_count > 0:
            dup_pct = (duplicate_count / n) * 100.0
            if dup_pct >= 2.0:
                facts.append(
                    StructuredInsightFact(
                        id="data_quality_duplicate_rows",
                        category=InsightCategory.DATA_QUALITY.value,
                        title="Duplicate Records Identified",
                        severity=InsightSeverity.WARNING.value,
                        direction=InsightDirection.NEUTRAL.value,
                        feature="dataset_rows",
                        current_value=round(dup_pct, 1),
                        comparison_value=0.0,
                        confidence=0.99,
                        explanation=(
                            f"{duplicate_count:,} duplicate rows ({dup_pct:.1f}% of dataset) were detected. "
                            f"Deduplication via Phase 2 cleaning is recommended to prevent over-weighting in downstream models."
                        ),
                        supporting_evidence={
                            "duplicate_count": duplicate_count,
                            "total_rows": n,
                            "duplicate_percentage": round(dup_pct, 2),
                        },
                    )
                )

        return facts

    def _extract_forecasting_insights(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> List[StructuredInsightFact]:
        """Integrates Phase 6 Time-Series Forecasting models."""
        facts: List[StructuredInsightFact] = []
        stmt = (
            select(ForecastModel)
            .where(ForecastModel.dataset_id == dataset_id, ForecastModel.user_id == user_id)
            .order_by(desc(ForecastModel.created_at))
            .limit(1)
        )
        model = db.execute(stmt).scalars().first()
        if not model or not model.forecast_points or not model.historical_points:
            return facts

        last_actual = model.historical_points[-1]["value"]
        forecast_end = model.forecast_points[-1]["forecast"]
        horizon = getattr(model, "forecast_horizon", getattr(model, "horizon", 7))

        if abs(last_actual) > 1e-6:
            pct_change = ((forecast_end - last_actual) / abs(last_actual)) * 100.0
            direction = InsightDirection.UPWARD.value if pct_change > 0 else InsightDirection.DOWNWARD.value
            verb = "growth" if pct_change > 0 else "decline"
            severity = InsightSeverity.POSITIVE.value if pct_change > 0 else InsightSeverity.WARNING.value

            facts.append(
                StructuredInsightFact(
                    id=f"forecast_projection_{model.target_column}",
                    category=InsightCategory.FORECAST.value,
                    title=f"Projected {abs(pct_change):.1f}% {verb.capitalize()} in '{model.target_column}'",
                    severity=severity,
                    direction=direction,
                    feature=model.target_column,
                    current_value=round(forecast_end, 2),
                    comparison_value=round(last_actual, 2),
                    change_pct=round(pct_change, 1),
                    change_abs=round(forecast_end - last_actual, 2),
                    confidence=0.88,
                    explanation=(
                        f"ARIMA time-series model '{model.name}' projects a {abs(pct_change):.1f}% {verb} "
                        f"in '{model.target_column}' over the next {horizon} {model.frequency} periods "
                        f"(advancing from baseline {last_actual:.2f} to {forecast_end:.2f})."
                    ),
                    supporting_evidence={
                        "model_name": model.name,
                        "model_order": getattr(model, "model_order", (model.model_parameters or {}).get("order", "ARIMA")),
                        "horizon": horizon,
                        "frequency": model.frequency,
                        "last_historical_value": round(last_actual, 4),
                        "projected_end_value": round(forecast_end, 4),
                        "projected_change_pct": round(pct_change, 2),
                    },
                )
            )

        return facts

    def _extract_anomaly_insights(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> List[StructuredInsightFact]:
        """Integrates Phase 7 Isolation Forest Anomaly Detection results."""
        facts: List[StructuredInsightFact] = []
        stmt = (
            select(AnomalyModel)
            .where(AnomalyModel.dataset_id == dataset_id, AnomalyModel.user_id == user_id)
            .order_by(desc(AnomalyModel.created_at))
            .limit(1)
        )
        model = db.execute(stmt).scalars().first()
        if not model:
            return facts

        anom_pct = model.anomaly_percentage
        anom_count = model.n_anomalies
        total = model.n_samples

        severity = InsightSeverity.WARNING.value if anom_pct >= self.config.anomaly_rate_warning_threshold else InsightSeverity.INFO.value

        # Extract top deviation feature from anomalous rows if present
        primary_driver = None
        if model.anomalous_rows and len(model.anomalous_rows) > 0:
            first_row = model.anomalous_rows[0]
            if first_row.get("top_deviations"):
                top_dev = first_row["top_deviations"][0]
                primary_driver = f"'{top_dev.get('feature')}' (z-score {top_dev.get('z_score', 0):+.1f}σ)"

        driver_detail = f", with highest deviations observed in {primary_driver}" if primary_driver else ""

        facts.append(
            StructuredInsightFact(
                id=f"anomaly_prevalence_{model.id}",
                category=InsightCategory.ANOMALY.value,
                title=f"Statistical Outliers Flagged ({anom_pct:.1f}% Rate)",
                severity=severity,
                direction=InsightDirection.ANOMALOUS.value,
                feature=",".join(model.feature_names[:3]),
                current_value=round(anom_pct, 1),
                comparison_value=model.contamination * 100.0,
                confidence=0.92,
                explanation=(
                    f"Isolation Forest detection identified {anom_count:,} anomalous observations "
                    f"({anom_pct:.1f}% of {total:,} records) using tree isolation threshold {model.threshold_score:.4f}{driver_detail}."
                ),
                supporting_evidence={
                    "anomaly_count": anom_count,
                    "total_samples": total,
                    "anomaly_percentage": round(anom_pct, 2),
                    "threshold_score": round(model.threshold_score, 4),
                    "features_evaluated": model.feature_names,
                },
            )
        )

        return facts

    def _extract_ml_insights(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> List[StructuredInsightFact]:
        """Integrates Phase 4 Supervised ML model leaderboard and feature importance."""
        facts: List[StructuredInsightFact] = []
        stmt = (
            select(MLModel)
            .where(MLModel.dataset_id == dataset_id, MLModel.user_id == user_id)
            .order_by(desc(MLModel.created_at))
            .limit(1)
        )
        model = db.execute(stmt).scalars().first()
        if not model:
            return facts

        # Metrics check
        metrics = model.metrics or {} if hasattr(model, "metrics") and isinstance(model.metrics, dict) else {}
        r2_val = metrics.get("r2") or getattr(model, "r2", None)
        acc_val = metrics.get("accuracy") or getattr(model, "accuracy", None)
        metric_str = ""
        confidence = 0.85
        if model.task_type == "regression" and r2_val is not None:
            metric_str = f"R² score of {r2_val:.3f}"
            confidence = min(0.98, max(0.60, r2_val))
        elif model.task_type == "classification" and acc_val is not None:
            metric_str = f"classification accuracy of {(acc_val * 100):.1f}%"
            confidence = min(0.98, max(0.60, acc_val))

        imp_str = ""
        feat_imp = getattr(model, "feature_importance", None) or metrics.get("feature_importance")
        if feat_imp and isinstance(feat_imp, dict):
            sorted_imp = sorted(feat_imp.items(), key=lambda x: x[1], reverse=True)[:2]
            imp_str = f", driven primarily by {sorted_imp[0][0]} ({sorted_imp[0][1] * 100:.1f}%)"
            if len(sorted_imp) > 1:
                imp_str += f" and {sorted_imp[1][0]} ({sorted_imp[1][1] * 100:.1f}%)"

        facts.append(
            StructuredInsightFact(
                id=f"ml_performance_{model.target_column}",
                category=InsightCategory.MODEL_PERFORMANCE.value,
                title=f"Predictive Model Fit for '{model.target_column}'",
                severity=InsightSeverity.POSITIVE.value if confidence >= 0.80 else InsightSeverity.INFO.value,
                direction=InsightDirection.POSITIVE.value,
                feature=model.target_column,
                confidence=round(confidence, 2),
                explanation=(
                    f"Supervised ML benchmark selected '{model.algorithm}' for target '{model.target_column}' "
                    f"achieving {metric_str}{imp_str}."
                ),
                supporting_evidence={
                    "algorithm": model.algorithm,
                    "task_type": model.task_type,
                    "target_column": model.target_column,
                    "r2": round(r2_val, 4) if r2_val is not None else None,
                    "rmse": round(metrics.get("rmse"), 4) if metrics.get("rmse") is not None else None,
                    "accuracy": round(acc_val, 4) if acc_val is not None else None,
                },
            )
        )

        return facts

    # =========================================================================
    # Helpers: Deduplication, Prioritization & Data Loading
    # =========================================================================

    def _deduplicate_and_prioritize(
        self,
        facts: List[StructuredInsightFact],
        limit: int = 25,
    ) -> List[StructuredInsightFact]:
        """
        Deduplicates insights using (category, feature, secondary_feature, direction).
        Prioritizes by severity weight and confidence score.
        """
        severity_weights = {
            InsightSeverity.CRITICAL.value: 100,
            InsightSeverity.WARNING.value: 70,
            InsightSeverity.POSITIVE.value: 50,
            InsightSeverity.INFO.value: 30,
        }

        # Strict exclusion: purge any fact referencing an identifier column
        valid_facts = [
            f for f in facts
            if not (f.feature and column_classifier.is_identifier(f.feature))
            and not (f.secondary_feature and column_classifier.is_identifier(f.secondary_feature))
        ]

        # Deduplicate
        unique_map: Dict[Tuple[str, str, Optional[str], str], StructuredInsightFact] = {}
        for f in valid_facts:
            key = (f.category, f.feature, f.secondary_feature, f.direction)
            if key not in unique_map:
                unique_map[key] = f
            else:
                # If duplicate key exists, keep the one with higher confidence
                if f.confidence > unique_map[key].confidence:
                    unique_map[key] = f

        deduped = list(unique_map.values())

        # Sort descending by priority: severity_weight * 0.6 + confidence * 40
        def priority_score(fact: StructuredInsightFact) -> float:
            base = severity_weights.get(fact.severity, 20)
            return base * 0.6 + fact.confidence * 40.0

        deduped.sort(key=priority_score, reverse=True)
        return deduped[:limit]

    def _compute_kpi_summary(self, facts: List[StructuredInsightFact]) -> InsightKPISummary:
        kpi = InsightKPISummary(total_insights=len(facts))
        for f in facts:
            if f.severity == InsightSeverity.CRITICAL.value:
                kpi.critical_count += 1
            elif f.severity == InsightSeverity.WARNING.value:
                kpi.warning_count += 1
            elif f.severity == InsightSeverity.POSITIVE.value:
                kpi.positive_count += 1
            else:
                kpi.info_count += 1

        kpi.categories_covered = sorted(list(set(f.category for f in facts)))
        return kpi

    def _load_dataframe(self, dataset: Dataset, use_cleaned: bool = True) -> Optional[pd.DataFrame]:
        file_path = dataset.cleaned_file_path if (use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path) else dataset.file_path
        if not file_path or not os.path.exists(file_path):
            file_path = dataset.file_path

        if not file_path or not os.path.exists(file_path):
            return None

        try:
            return pd.read_csv(file_path)
        except Exception as err:
            logger.error(f"Failed to read dataset CSV: {err}")
            return None

    def _filter_report(
        self,
        report: InsightReport,
        category: Optional[str] = None,
        min_severity: Optional[str] = None,
    ) -> InsightReportResponse:
        parsed_insights = [
            StructuredInsightFact(**item)
            for item in (report.insights or [])
            if not column_classifier.is_identifier(item.get("feature", ""))
            and not column_classifier.is_identifier(item.get("secondary_feature", ""))
        ]

        if category:
            parsed_insights = [f for f in parsed_insights if f.category.lower() == category.lower()]

        if min_severity:
            severity_order = {
                InsightSeverity.INFO.value: 1,
                InsightSeverity.POSITIVE.value: 2,
                InsightSeverity.WARNING.value: 3,
                InsightSeverity.CRITICAL.value: 4,
            }
            min_rank = severity_order.get(min_severity.lower(), 1)
            parsed_insights = [f for f in parsed_insights if severity_order.get(f.severity.lower(), 1) >= min_rank]

        kpi = InsightKPISummary(**report.kpi_summary)

        return InsightReportResponse(
            id=report.id,
            dataset_id=report.dataset_id,
            user_id=report.user_id,
            title=report.title,
            summary=report.summary,
            total_insights=len(parsed_insights),
            is_cleaned=report.is_cleaned,
            llm_polished=report.llm_polished,
            kpi_summary=kpi,
            categories=report.categories,
            insights=parsed_insights,
            created_at=report.created_at,
        )

insights_service = BusinessInsightsService()
