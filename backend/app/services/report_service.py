import io
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import joblib

# Headless matplotlib configuration
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ReportLab imports
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.cleaning_report import CleaningReport
from app.models.eda_report import EDAReport
from app.models.ml import MLJob, MLModel
from app.models.clustering import ClusteringModel
from app.models.forecasting import ForecastModel
from app.models.anomaly import AnomalyModel
from app.models.insight import InsightReport
from app.repositories.report_repository import report_repository
from app.schemas.report import (
    ReportSectionStatus,
    ReportReadinessResponse,
    CSVExportPreviewResponse,
)

logger = logging.getLogger(__name__)


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to compute and render total page count 'Page X of Y'
    along with running executive headers and footers.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Running header (on pages after cover/page 1)
        if self._pageNumber > 1:
            self.drawString(36, 11 * inch - 26, "INFOLOOM BUSINESS ANALYTICS REPORT")
            self.drawRightString(8.5 * inch - 36, 11 * inch - 26, datetime.now().strftime("%B %d, %Y"))
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 11 * inch - 30, 8.5 * inch - 36, 11 * inch - 30)

        # Running footer (all pages)
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 22, page_str)
        self.drawString(36, 22, "InfoLoom Analytics Platform • Confidential")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 32, 8.5 * inch - 36, 32)
        self.restoreState()


class ReportGenerationService:
    """
    Service responsible for assembling comprehensive organization-facing PDF analytics reports
    and exporting prediction datasets as structured CSV packages.
    """

    def get_report_readiness(
        self,
        db: Session,
        dataset: Dataset,
        user_id: int,
    ) -> ReportReadinessResponse:
        """
        Inspects existing persisted results and returns the readiness status
        for each business report section.
        """
        sections: List[ReportSectionStatus] = []

        # 1. Overview
        sections.append(
            ReportSectionStatus(
                key="overview",
                name="Dataset Metadata & Schema",
                phase="Overview",
                status="available",
                detail=f"{dataset.row_count:,} rows × {dataset.column_count} columns",
                record_count=dataset.row_count,
            )
        )

        # 2. Cleaning & Validation
        cleaning_stmt = (
            select(CleaningReport)
            .where(CleaningReport.dataset_id == dataset.id, CleaningReport.user_id == user_id)
            .order_by(desc(CleaningReport.created_at))
            .limit(1)
        )
        cleaning = db.execute(cleaning_stmt).scalars().first()
        cs = cleaning.cleaning_summary or {} if cleaning else {}
        cleaned_rows = cs.get("final_shape", {}).get("rows", dataset.row_count)
        sections.append(
            ReportSectionStatus(
                key="cleaning",
                name="Data Quality & Cleaning Audit",
                phase="Data Quality",
                status="available" if cleaning else "unavailable",
                detail=(
                    f"Cleaned pipeline active ({cleaned_rows:,} rows)"
                    if cleaning
                    else "Raw dataset profile active"
                ),
            )
        )

        # 3. EDA
        eda_stmt = (
            select(EDAReport)
            .where(EDAReport.dataset_id == dataset.id, EDAReport.user_id == user_id)
            .order_by(desc(EDAReport.created_at))
            .limit(1)
        )
        eda = db.execute(eda_stmt).scalars().first()
        sections.append(
            ReportSectionStatus(
                key="eda",
                name="Exploratory Data Analysis & Correlations",
                phase="Exploration",
                status="available" if eda else "unavailable",
                detail=(
                    f"Statistical profiles, correlations ({len(eda.correlation_matrix.get('strong_correlations', []))} strong pairs)"
                    if eda
                    else "Exploratory analysis not generated yet"
                ),
            )
        )

        # 4. Supervised ML
        ml_stmt = (
            select(MLModel)
            .where(MLModel.dataset_id == dataset.id, MLModel.user_id == user_id)
            .order_by(desc(MLModel.is_best), desc(MLModel.created_at))
            .limit(10)
        )
        ml_models = list(db.execute(ml_stmt).scalars().all())
        sections.append(
            ReportSectionStatus(
                key="ml_models",
                name="Predictive Modeling Benchmarks",
                phase="Predictive",
                status="available" if ml_models else "unavailable",
                detail=(
                    f"{len(ml_models)} trained models (Top: {ml_models[0].algorithm})"
                    if ml_models
                    else "No predictive models trained yet"
                ),
                record_count=len(ml_models),
            )
        )

        # 5. Clustering
        clustering_stmt = (
            select(ClusteringModel)
            .where(ClusteringModel.dataset_id == dataset.id, ClusteringModel.user_id == user_id)
            .order_by(desc(ClusteringModel.created_at))
            .limit(1)
        )
        clustering = db.execute(clustering_stmt).scalars().first()
        sections.append(
            ReportSectionStatus(
                key="clustering",
                name="Customer & Entity Segmentation",
                phase="Segmentation",
                status="available" if clustering else "unavailable",
                detail=(
                    f"{clustering.k} segments identified (Silhouette: {clustering.silhouette_score:.3f})"
                    if clustering
                    else "Segmentation analysis not run yet"
                ),
            )
        )

        # 6. Forecasting
        forecast_stmt = (
            select(ForecastModel)
            .where(ForecastModel.dataset_id == dataset.id, ForecastModel.user_id == user_id)
            .order_by(desc(ForecastModel.created_at))
            .limit(1)
        )
        forecast = db.execute(forecast_stmt).scalars().first()
        sections.append(
            ReportSectionStatus(
                key="forecasting",
                name="Time-Series Forecasting Trajectory",
                phase="Forecasting",
                status="available" if forecast else "unavailable",
                detail=(
                    f"Horizon: {forecast.forecast_horizon} {forecast.frequency} steps on '{forecast.target_column}'"
                    if forecast
                    else "Forecasting analysis not executed yet"
                ),
            )
        )

        # 7. Anomaly Detection
        anomaly_stmt = (
            select(AnomalyModel)
            .where(AnomalyModel.dataset_id == dataset.id, AnomalyModel.user_id == user_id)
            .order_by(desc(AnomalyModel.created_at))
            .limit(1)
        )
        anomaly = db.execute(anomaly_stmt).scalars().first()
        sections.append(
            ReportSectionStatus(
                key="anomalies",
                name="Anomaly & Outlier Diagnostics",
                phase="Outliers",
                status="available" if anomaly else "unavailable",
                detail=(
                    f"{anomaly.n_anomalies} outliers flagged ({anomaly.anomaly_percentage:.1f}%)"
                    if anomaly
                    else "Anomaly detection not run yet"
                ),
                record_count=anomaly.n_anomalies if anomaly else 0,
            )
        )

        # 8. Business Insights
        insight_stmt = (
            select(InsightReport)
            .where(InsightReport.dataset_id == dataset.id, InsightReport.user_id == user_id)
            .order_by(desc(InsightReport.created_at))
            .limit(1)
        )
        insights = db.execute(insight_stmt).scalars().first()
        sections.append(
            ReportSectionStatus(
                key="insights",
                name="Business Insights & Strategic Signals",
                phase="Insights",
                status="available" if insights else "unavailable",
                detail=(
                    f"{insights.total_insights} strategic facts synthesized"
                    if insights
                    else "Business insights not compiled yet"
                ),
                record_count=insights.total_insights if insights else 0,
            )
        )

        available_count = sum(1 for s in sections if s.status == "available")

        return ReportReadinessResponse(
            dataset_id=dataset.id,
            dataset_name=dataset.original_filename,
            total_rows=dataset.row_count or 0,
            total_columns=dataset.column_count or 0,
            has_cleaned=bool(dataset.has_cleaned),
            sections=sections,
            available_sections_count=available_count,
            total_sections_count=len(sections),
            ready_for_pdf=True,
        )

    def generate_pdf_report(
        self,
        db: Session,
        dataset: Dataset,
        user_id: int,
    ) -> Tuple[str, bytes]:
        """
        Assembles all cached and persisted analytics into an executive PDF report.
        Returns (file_name, pdf_bytes).
        """
        # Fetch analytical records
        cleaning = db.execute(
            select(CleaningReport)
            .where(CleaningReport.dataset_id == dataset.id, CleaningReport.user_id == user_id)
            .order_by(desc(CleaningReport.created_at))
            .limit(1)
        ).scalars().first()

        eda = db.execute(
            select(EDAReport)
            .where(EDAReport.dataset_id == dataset.id, EDAReport.user_id == user_id)
            .order_by(desc(EDAReport.created_at))
            .limit(1)
        ).scalars().first()

        ml_models = list(
            db.execute(
                select(MLModel)
                .where(MLModel.dataset_id == dataset.id, MLModel.user_id == user_id)
                .order_by(desc(MLModel.is_best), desc(MLModel.created_at))
                .limit(5)
            ).scalars().all()
        )

        clustering = db.execute(
            select(ClusteringModel)
            .where(ClusteringModel.dataset_id == dataset.id, ClusteringModel.user_id == user_id)
            .order_by(desc(ClusteringModel.created_at))
            .limit(1)
        ).scalars().first()

        forecast = db.execute(
            select(ForecastModel)
            .where(ForecastModel.dataset_id == dataset.id, ForecastModel.user_id == user_id)
            .order_by(desc(ForecastModel.created_at))
            .limit(1)
        ).scalars().first()

        anomaly = db.execute(
            select(AnomalyModel)
            .where(AnomalyModel.dataset_id == dataset.id, AnomalyModel.user_id == user_id)
            .order_by(desc(AnomalyModel.created_at))
            .limit(1)
        ).scalars().first()

        insight_report = db.execute(
            select(InsightReport)
            .where(InsightReport.dataset_id == dataset.id, InsightReport.user_id == user_id)
            .order_by(desc(InsightReport.created_at))
            .limit(1)
        ).scalars().first()

        # Build Flowables
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=42,
            bottomMargin=42,
        )

        styles = getSampleStyleSheet()
        self._configure_custom_styles(styles)

        story = []
        section_idx = 1

        # 1. Header Banner
        story.append(self._build_header_banner(dataset, styles))
        story.append(Spacer(1, 12))

        # 2. Executive Summary Metrics
        story.append(
            self._build_executive_kpi_table(
                dataset, eda, ml_models, clustering, forecast, anomaly, insight_report, styles
            )
        )
        story.append(Spacer(1, 14))

        # 3. Dataset Overview & Data Quality (Always included)
        story.append(
            self._build_section_header(f"{section_idx}. Dataset Overview & Data Health", "DATA INTEGRITY", styles)
        )
        story.append(self._build_cleaning_section(dataset, cleaning, styles))
        story.append(Spacer(1, 14))
        section_idx += 1

        # 4. Key Business Insights & Strategic Findings (Only if insights exist)
        if insight_report and insight_report.insights:
            insights_table = self._build_insights_section(insight_report, styles)
            if insights_table:
                story.append(
                    self._build_section_header(f"{section_idx}. Key Business Insights & Strategic Findings", "STRATEGIC FINDINGS", styles)
                )
                story.append(insights_table)
                story.append(Spacer(1, 14))
                section_idx += 1

        # 5. Exploratory Data Analysis & Correlations (Only if EDA exists)
        if eda:
            eda_table = self._build_eda_section(eda, styles)
            if eda_table:
                story.append(
                    self._build_section_header(f"{section_idx}. Exploratory Analysis & Attribute Relationships", "EXPLORATION", styles)
                )
                story.append(eda_table)
                story.append(Spacer(1, 14))
                section_idx += 1

        # 6. Customer & Entity Segmentation (Only if clustering exists)
        if clustering and clustering.cluster_profiles:
            cluster_table = self._build_clustering_section(clustering, styles)
            if cluster_table:
                story.append(
                    self._build_section_header(f"{section_idx}. Customer & Entity Segmentation Analysis", "SEGMENTATION", styles)
                )
                story.append(cluster_table)
                clustering_chart = self._generate_clustering_chart(clustering)
                if clustering_chart:
                    story.append(Spacer(1, 6))
                    story.append(clustering_chart)
                story.append(Spacer(1, 14))
                section_idx += 1

        # 7. Predictive Modeling & Benchmarks (Only if ML models exist)
        if ml_models:
            ml_table = self._build_ml_section(ml_models, styles)
            if ml_table:
                story.append(
                    self._build_section_header(f"{section_idx}. Predictive Modeling & Performance Benchmarks", "PREDICTIVE MODELING", styles)
                )
                story.append(ml_table)
                ml_chart = self._generate_ml_chart(ml_models)
                if ml_chart:
                    story.append(Spacer(1, 6))
                    story.append(ml_chart)
                story.append(Spacer(1, 14))
                section_idx += 1

        # 8. Time-Series Forecasting (Only if forecast exists)
        if forecast and forecast.forecast_points:
            forecast_table = self._build_forecasting_section(forecast, styles)
            if forecast_table:
                story.append(
                    self._build_section_header(f"{section_idx}. Time-Series Forecasting & Projected Trajectory", "FORECASTING", styles)
                )
                story.append(forecast_table)
                forecast_chart = self._generate_forecast_chart(forecast)
                if forecast_chart:
                    story.append(Spacer(1, 6))
                    story.append(forecast_chart)
                story.append(Spacer(1, 14))
                section_idx += 1

        # 9. Anomaly & Outlier Diagnostics (Only if anomaly model exists)
        if anomaly:
            anomaly_table = self._build_anomaly_section(anomaly, styles)
            if anomaly_table:
                story.append(
                    self._build_section_header(f"{section_idx}. Anomaly & Outlier Diagnostics", "OUTLIER ANALYSIS", styles)
                )
                story.append(anomaly_table)
                anomaly_chart = self._generate_anomaly_chart(anomaly)
                if anomaly_chart:
                    story.append(Spacer(1, 6))
                    story.append(anomaly_chart)
                story.append(Spacer(1, 14))
                section_idx += 1

        # 10. Recommendations & Areas for Attention
        story.append(
            self._build_section_header(f"{section_idx}. Strategic Recommendations & Areas for Attention", "RECOMMENDATIONS", styles)
        )
        story.append(
            self._build_recommendations_section(
                dataset, cleaning, eda, ml_models, clustering, forecast, anomaly, insight_report, styles
            )
        )

        # Build PDF
        doc.build(story, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        file_name = f"InfoLoom_Report_{dataset.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        # Record in database history
        sections_included = [
            s.key for s in self.get_report_readiness(db, dataset, user_id).sections if s.status == "available"
        ]
        report_repository.create(
            db=db,
            dataset_id=dataset.id,
            user_id=user_id,
            title=f"Business Analytics Report: {dataset.original_filename}",
            report_type="comprehensive_pdf",
            file_name=file_name,
            file_size_bytes=len(pdf_bytes),
            sections_included=sections_included,
            metadata_summary={
                "rows": dataset.row_count,
                "columns": dataset.column_count,
                "generated_at": datetime.now().isoformat(),
            },
        )

        return file_name, pdf_bytes

    # =========================================================================
    # CSV Prediction Export
    # =========================================================================

    def preview_predictions_csv(
        self,
        db: Session,
        dataset: Dataset,
        user_id: int,
        export_type: str = "ml",
        model_id: Optional[int] = None,
    ) -> CSVExportPreviewResponse:
        """
        Generates the first 5 preview rows of the predictions export package.
        """
        df_export, model_name = self._assemble_export_dataframe(
            db, dataset, user_id, export_type, model_id
        )

        preview_rows = df_export.head(5).to_dict(orient="records")
        # Ensure clean serializable types
        clean_preview = []
        for r in preview_rows:
            clean_preview.append({k: (None if pd.isna(v) else v) for k, v in r.items()})

        return CSVExportPreviewResponse(
            export_type=export_type,
            model_id=model_id,
            model_name=model_name,
            total_rows=len(df_export),
            columns=list(df_export.columns),
            preview_rows=clean_preview,
        )

    def export_predictions_csv(
        self,
        db: Session,
        dataset: Dataset,
        user_id: int,
        export_type: str = "ml",
        model_id: Optional[int] = None,
    ) -> Tuple[str, bytes]:
        """
        Exports prediction package as a CSV binary stream.
        Returns (file_name, csv_bytes).
        """
        df_export, model_name = self._assemble_export_dataframe(
            db, dataset, user_id, export_type, model_id
        )

        csv_str = df_export.to_csv(index=False)
        csv_bytes = csv_str.encode("utf-8")

        clean_type = export_type.lower()
        file_name = f"infoloom_{clean_type}_predictions_dataset_{dataset.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        # Record in history
        report_repository.create(
            db=db,
            dataset_id=dataset.id,
            user_id=user_id,
            title=f"{clean_type.upper()} Predictions Export: {model_name}",
            report_type=f"{clean_type}_csv",
            file_name=file_name,
            file_size_bytes=len(csv_bytes),
            sections_included=[export_type],
            metadata_summary={
                "model_name": model_name,
                "exported_rows": len(df_export),
                "exported_columns": list(df_export.columns),
            },
        )

        return file_name, csv_bytes

    def _assemble_export_dataframe(
        self,
        db: Session,
        dataset: Dataset,
        user_id: int,
        export_type: str,
        model_id: Optional[int] = None,
    ) -> Tuple[pd.DataFrame, str]:
        """Assembles export DataFrame based on model type."""
        export_type = export_type.lower()

        if export_type == "forecast":
            stmt = select(ForecastModel).where(
                ForecastModel.dataset_id == dataset.id, ForecastModel.user_id == user_id
            )
            if model_id:
                stmt = stmt.where(ForecastModel.id == model_id)
            else:
                stmt = stmt.order_by(desc(ForecastModel.created_at))

            model = db.execute(stmt).scalars().first()
            if not model or not model.forecast_points:
                raise ValueError("No forecast predictions found for this dataset.")

            rows = []
            for idx, pt in enumerate(model.forecast_points, start=1):
                rows.append({
                    "horizon_step": idx,
                    "timestamp": pt.get("timestamp") or pt.get("date"),
                    "forecast_value": pt.get("forecast"),
                    "lower_ci_95": pt.get("lower_ci"),
                    "upper_ci_95": pt.get("upper_ci"),
                    "target_column": model.target_column,
                    "frequency": model.frequency,
                    "model_algorithm": model.name,
                })
            return pd.DataFrame(rows), model.name

        elif export_type == "anomaly":
            stmt = select(AnomalyModel).where(
                AnomalyModel.dataset_id == dataset.id, AnomalyModel.user_id == user_id
            )
            if model_id:
                stmt = stmt.where(AnomalyModel.id == model_id)
            else:
                stmt = stmt.order_by(desc(AnomalyModel.created_at))

            model = db.execute(stmt).scalars().first()
            if not model:
                raise ValueError("No anomaly detection model found for this dataset.")

            # Load dataset to export full row predictions
            raw_df = self._load_dataset_df(dataset, use_cleaned=model.use_cleaned)
            if raw_df is None:
                raise ValueError("Source dataset file could not be loaded.")

            # Check if artifact path exists for direct prediction or use score points
            if model.artifact_path and os.path.exists(model.artifact_path):
                try:
                    artifact_data = joblib.load(model.artifact_path)
                    iso_model = artifact_data.get("model") if isinstance(artifact_data, dict) else artifact_data
                    feat_cols = [c for c in model.feature_names if c in raw_df.columns]
                    X_input = raw_df[feat_cols].copy()
                    for c in feat_cols:
                        med = X_input[c].median()
                        X_input[c] = X_input[c].fillna(med if not pd.isna(med) else 0.0)

                    X_vals = X_input.values
                    means = np.mean(X_vals, axis=0)
                    stds = np.std(X_vals, axis=0)
                    stds[stds == 0] = 1.0
                    X_scaled = (X_vals - means) / stds

                    raw_scores = iso_model.decision_function(X_scaled)
                    predictions = iso_model.predict(X_scaled)  # -1 = anomaly, 1 = normal

                    df_out = raw_df.copy()
                    df_out["isolation_forest_score"] = raw_scores
                    df_out["is_anomaly"] = predictions == -1
                    df_out["detection_label"] = np.where(predictions == -1, "ANOMALY", "NORMAL")
                    return df_out, model.name
                except Exception as e:
                    logger.warning(f"Could not load artifact for anomaly export: {e}")

            # Fallback using dataset and recorded anomalous rows
            anom_indices = set(r.get("index") for r in (model.anomalous_rows or []))
            df_out = raw_df.copy()
            df_out["is_anomaly"] = [i in anom_indices for i in df_out.index]
            df_out["detection_label"] = np.where(df_out["is_anomaly"], "ANOMALY", "NORMAL")
            return df_out, model.name

        else:
            # Default: Supervised ML Predictions
            stmt = select(MLModel).where(
                MLModel.dataset_id == dataset.id, MLModel.user_id == user_id
            )
            if model_id:
                stmt = stmt.where(MLModel.id == model_id)
            else:
                stmt = stmt.order_by(desc(MLModel.is_best), desc(MLModel.created_at))

            model = db.execute(stmt).scalars().first()
            if not model:
                raise ValueError("No trained machine learning model found for this dataset.")

            raw_df = self._load_dataset_df(dataset, use_cleaned=True)
            if raw_df is None:
                raise ValueError("Source dataset file could not be loaded.")

            if not model.artifact_path or not os.path.exists(model.artifact_path):
                raise ValueError(f"Model artifact not found at {model.artifact_path}")

            pipeline = joblib.load(model.artifact_path)
            feature_cols = [c for c in model.feature_names if c in raw_df.columns]
            X = raw_df[feature_cols]

            preds = pipeline.predict(X)

            export_df = pd.DataFrame()
            export_df["row_index"] = raw_df.index
            for c in feature_cols:
                export_df[c] = raw_df[c]

            target = model.target_column
            if target in raw_df.columns:
                export_df[f"actual_{target}"] = raw_df[target]

            export_df[f"predicted_{target}"] = preds

            if model.task_type == "regression" and target in raw_df.columns:
                try:
                    export_df["residual_error"] = raw_df[target] - preds
                except Exception:
                    pass

            return export_df, f"{model.algorithm} ({model.name})"

    # =========================================================================
    # PDF Visual Elements & Flowable Builders
    # =========================================================================

    def _configure_custom_styles(self, styles):
        """Adds curated, brand-aligned typography styles."""
    def _configure_custom_styles(self, styles):
        """Adds curated, brand-aligned typography styles for executive reporting."""
        styles.add(
            ParagraphStyle(
                "ReportTitle",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=18,
                leading=22,
                textColor=colors.HexColor("#0F172A"),
            )
        )
        styles.add(
            ParagraphStyle(
                "ReportSubtitle",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=8.5,
                leading=12,
                textColor=colors.HexColor("#64748B"),
                alignment=2,  # Right aligned
            )
        )
        styles.add(
            ParagraphStyle(
                "CategoryTag",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=7.5,
                leading=9,
                textColor=colors.HexColor("#6D28D9"),
            )
        )
        styles.add(
            ParagraphStyle(
                "SectionHeading",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=12,
                leading=15,
                textColor=colors.HexColor("#0F172A"),
            )
        )
        styles.add(
            ParagraphStyle(
                "ExecutiveNarrative",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=8.5,
                leading=12.5,
                textColor=colors.HexColor("#334155"),
            )
        )
        styles.add(
            ParagraphStyle(
                "BodyTextSmall",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=8.5,
                leading=12,
                textColor=colors.HexColor("#334155"),
            )
        )
        styles.add(
            ParagraphStyle(
                "TableHeader",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=8,
                leading=10,
                textColor=colors.HexColor("#FFFFFF"),
            )
        )
        styles.add(
            ParagraphStyle(
                "TableCell",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=8,
                leading=10.5,
                textColor=colors.HexColor("#1E293B"),
            )
        )
        styles.add(
            ParagraphStyle(
                "TableCellMono",
                parent=styles["Normal"],
                fontName="Courier",
                fontSize=8,
                leading=10,
                textColor=colors.HexColor("#0F172A"),
            )
        )
        styles.add(
            ParagraphStyle(
                "TableCellBold",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=8,
                leading=10.5,
                textColor=colors.HexColor("#0F172A"),
            )
        )

    def _build_header_banner(self, dataset: Dataset, styles):
        data = [
            [
                Paragraph("INFOLOOM BUSINESS ANALYTICS REPORT", styles["ReportTitle"]),
                Paragraph(
                    f"Generated: {datetime.now().strftime('%B %d, %Y')}<br/>"
                    f"Dataset Reference: #{dataset.id:04d}<br/>"
                    f"Classification: Executive / Confidential",
                    styles["ReportSubtitle"],
                ),
            ],
            [
                Paragraph(
                    f"Comprehensive analytical synthesis for <strong>{dataset.original_filename}</strong> "
                    f"synthesizing data profile, statistical findings, and business insights.",
                    styles["ExecutiveNarrative"],
                ),
                "",
            ],
        ]
        t = Table(data, colWidths=[5.1 * inch, 2.4 * inch])
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("SPAN", (0, 1), (1, 1)),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_executive_kpi_table(
        self, dataset, eda, ml_models, clustering, forecast, anomaly, insight_report, styles
    ):
        """Constructs top executive KPI callout box with dynamic analytical findings."""
        health_score = f"{100 - eda.kpis.get('missing_percentage', 0):.0f}%" if eda and eda.kpis else "100%"

        cards = [
            ("TOTAL RECORDS", f"{dataset.row_count:,}", "#0F172A"),
            ("ATTRIBUTES", f"{dataset.column_count}", "#0F172A"),
            ("DATA HEALTH", health_score, "#059669"),
        ]

        if insight_report and insight_report.total_insights:
            cards.append(("KEY FINDINGS", f"{insight_report.total_insights}", "#4F46E5"))
        elif ml_models:
            cards.append(("TOP MODEL", ml_models[0].algorithm, "#7C3AED"))
        elif clustering:
            cards.append(("SEGMENTS", f"{clustering.k} Cohorts", "#0284C7"))
        elif anomaly:
            cards.append(("OUTLIER RATE", f"{anomaly.anomaly_percentage:.1f}%", "#E11D48"))
        else:
            cards.append(("INGESTION", "Verified", "#059669"))

        if len(cards) < 5:
            if clustering and ("SEGMENTS" not in [c[0] for c in cards]):
                cards.append(("SEGMENTS", f"{clustering.k} Cohorts", "#0284C7"))
            elif anomaly and ("OUTLIER RATE" not in [c[0] for c in cards]):
                cards.append(("OUTLIER RATE", f"{anomaly.anomaly_percentage:.1f}%", "#E11D48"))
            elif forecast:
                cards.append(("FORECAST", f"{forecast.forecast_horizon} Periods", "#0284C7"))
            elif ml_models and ("TOP MODEL" not in [c[0] for c in cards]):
                cards.append(("TOP MODEL", ml_models[0].algorithm, "#7C3AED"))
            else:
                cards.append(("FILE SIZE", f"{(dataset.file_size_bytes / 1024):.1f} KB", "#475569"))

        col_w = (7.5 * inch) / len(cards)
        kpi_data = [
            [Paragraph(f"<strong>{c[0]}</strong>", styles["TableCellMono"]) for c in cards],
            [Paragraph(f"<font size=13 color='{c[2]}'><strong>{c[1]}</strong></font>", styles["Normal"]) for c in cards],
        ]
        t = Table(kpi_data, colWidths=[col_w] * len(cards))
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        return t

    def _build_section_header(self, title: str, category_tag: str, styles):
        elements = []
        if category_tag:
            elements.append(
                Paragraph(
                    f"<font color='#6D28D9'><strong>{category_tag.upper()}</strong></font>",
                    styles["CategoryTag"],
                )
            )
            elements.append(Spacer(1, 1))
        elements.append(
            Paragraph(
                f"<strong>{title}</strong>",
                styles["SectionHeading"],
            )
        )
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceBefore=3, spaceAfter=8))
        return KeepTogether(elements)

    def _build_cleaning_section(self, dataset: Dataset, cleaning: Optional[CleaningReport], styles):
        if not cleaning:
            data = [
                [
                    Paragraph("Data Source File", styles["TableCell"]),
                    Paragraph(str(dataset.original_filename), styles["TableCellMono"]),
                    Paragraph("Ingested Records", styles["TableCell"]),
                    Paragraph(f"{dataset.row_count:,}", styles["TableCellMono"]),
                ],
                [
                    Paragraph("Attribute Columns", styles["TableCell"]),
                    Paragraph(f"{dataset.column_count}", styles["TableCellMono"]),
                    Paragraph("File Size", styles["TableCell"]),
                    Paragraph(f"{(dataset.file_size_bytes / 1024):.1f} KB", styles["TableCellMono"]),
                ],
                [
                    Paragraph("Ingestion Status", styles["TableCell"]),
                    Paragraph("Verified & Indexed", styles["TableCellMono"]),
                    Paragraph("Data Baseline", styles["TableCell"]),
                    Paragraph("Original Schema Active", styles["TableCellMono"]),
                ],
            ]
        else:
            cs = cleaning.cleaning_summary or {}
            vs = cleaning.validation_summary or {}
            cleaned_rows = cs.get("final_shape", {}).get("rows", dataset.row_count)

            dups_removed = 0
            imputed_count = 0
            outliers_handled = 0
            for step in cs.get("steps_executed", []):
                if step.get("step") == "deduplication":
                    dups_removed = step.get("duplicates_removed", 0)
                elif step.get("step") == "imputation":
                    imputed_count = step.get("total_imputed", 0)
                elif step.get("step") == "outliers":
                    outliers_handled = step.get("outliers_clipped", step.get("outliers_removed", 0))

            if dups_removed == 0:
                dups_removed = vs.get("duplicate_rows", 0)
            if imputed_count == 0:
                imputed_count = vs.get("missing_cells", 0)

            missing_pct = vs.get("missing_percentage", 0.0)
            quality_score = max(0.0, 100.0 - float(missing_pct))

            data = [
                [
                    Paragraph("Raw Rows", styles["TableCell"]),
                    Paragraph(f"{dataset.row_count:,}", styles["TableCellMono"]),
                    Paragraph("Cleaned Rows", styles["TableCell"]),
                    Paragraph(f"{cleaned_rows:,}", styles["TableCellMono"]),
                ],
                [
                    Paragraph("Duplicates Removed", styles["TableCell"]),
                    Paragraph(f"{dups_removed:,}", styles["TableCellMono"]),
                    Paragraph("Missing Values Handled", styles["TableCell"]),
                    Paragraph(f"{imputed_count:,}", styles["TableCellMono"]),
                ],
                [
                    Paragraph("Outliers Clipped", styles["TableCell"]),
                    Paragraph(f"{outliers_handled:,}", styles["TableCellMono"]),
                    Paragraph("Data Quality Score", styles["TableCell"]),
                    Paragraph(f"{quality_score:.1f}% Clean", styles["TableCellMono"]),
                ],
            ]

        t = Table(data, colWidths=[1.8 * inch, 1.95 * inch, 1.8 * inch, 1.95 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_eda_section(self, eda: Optional[EDAReport], styles):
        if not eda:
            return None

        strong_corrs = eda.correlation_matrix.get("strong_correlations", [])[:5] if eda.correlation_matrix else []
        rows = [
            [
                Paragraph("Primary Feature", styles["TableHeader"]),
                Paragraph("Associated Feature", styles["TableHeader"]),
                Paragraph("Pearson r", styles["TableHeader"]),
                Paragraph("Relationship", styles["TableHeader"]),
            ]
        ]
        for c in strong_corrs:
            r = c.get("correlation", 0.0)
            rows.append([
                Paragraph(str(c.get("feature_a")), styles["TableCell"]),
                Paragraph(str(c.get("feature_b")), styles["TableCell"]),
                Paragraph(f"{r:+.3f}", styles["TableCellMono"]),
                Paragraph("Direct / Positive" if r > 0 else "Inverse / Negative", styles["TableCell"]),
            ])

        if len(rows) == 1:
            rows.append([Paragraph("No strong pairwise correlations (|r| >= 0.70) found across evaluated features.", styles["TableCell"]), "", "", ""])

        t = Table(rows, colWidths=[2.2 * inch, 2.2 * inch, 1.5 * inch, 1.6 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_ml_section(self, models: List[MLModel], styles):
        if not models:
            return None

        rows = [
            [
                Paragraph("Model Architecture", styles["TableHeader"]),
                Paragraph("Task", styles["TableHeader"]),
                Paragraph("Target Variable", styles["TableHeader"]),
                Paragraph("Primary Metric (R² / Acc)", styles["TableHeader"]),
                Paragraph("Selection", styles["TableHeader"]),
            ]
        ]
        for m in models:
            metrics_dict = m.metrics or {} if hasattr(m, "metrics") and isinstance(m.metrics, dict) else {}
            r2_val = metrics_dict.get("r2")
            acc_val = metrics_dict.get("accuracy")
            if m.task_type == "regression":
                metric_str = f"R² = {r2_val:.3f}" if r2_val is not None else "N/A"
            else:
                metric_str = f"Accuracy = {(acc_val * 100):.1f}%" if acc_val is not None else "N/A"
            is_best_label = "★ SELECTED BEST" if m.is_best else "Benchmarked"
            rows.append([
                Paragraph(str(m.algorithm), styles["TableCell"]),
                Paragraph(str(m.task_type).capitalize(), styles["TableCell"]),
                Paragraph(str(m.target_column), styles["TableCell"]),
                Paragraph(metric_str, styles["TableCellMono"]),
                Paragraph(is_best_label, styles["TableCellBold"] if m.is_best else styles["TableCell"]),
            ])

        t = Table(rows, colWidths=[2.1 * inch, 1.2 * inch, 1.5 * inch, 1.6 * inch, 1.1 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_clustering_section(self, clustering: Optional[ClusteringModel], styles):
        if not clustering or not clustering.cluster_profiles:
            return None

        rows = [
            [
                Paragraph("Segment ID", styles["TableHeader"]),
                Paragraph("Segment Profile", styles["TableHeader"]),
                Paragraph("Observations", styles["TableHeader"]),
                Paragraph("Percentage Share", styles["TableHeader"]),
            ]
        ]
        for p in clustering.cluster_profiles or []:
            rows.append([
                Paragraph(f"Segment #{p.get('cluster_id')}", styles["TableCellMono"]),
                Paragraph(str(p.get("name")), styles["TableCell"]),
                Paragraph(f"{p.get('size'):,}", styles["TableCellMono"]),
                Paragraph(f"{p.get('percentage'):.1f}%", styles["TableCellMono"]),
            ])

        t = Table(rows, colWidths=[1.5 * inch, 2.9 * inch, 1.5 * inch, 1.6 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_forecasting_section(self, forecast: Optional[ForecastModel], styles):
        if not forecast:
            return None

        data = [
            [
                Paragraph("Target Metric", styles["TableCell"]),
                Paragraph(str(forecast.target_column), styles["TableCellMono"]),
                Paragraph("Date Column", styles["TableCell"]),
                Paragraph(str(forecast.date_column), styles["TableCellMono"]),
            ],
            [
                Paragraph("Forecast Horizon", styles["TableCell"]),
                Paragraph(f"{forecast.forecast_horizon} ({forecast.frequency})", styles["TableCellMono"]),
                Paragraph("Historical Baseline", styles["TableCell"]),
                Paragraph(f"{forecast.n_historical_points:,} Points", styles["TableCellMono"]),
            ],
            [
                Paragraph("Model Method", styles["TableCell"]),
                Paragraph("Autoregressive Time-Series", styles["TableCellMono"]),
                Paragraph("Backtest Accuracy (MAPE)", styles["TableCell"]),
                Paragraph(f"{forecast.metrics.get('mape', 0):.2f}%", styles["TableCellMono"]),
            ],
        ]
        t = Table(data, colWidths=[1.8 * inch, 1.95 * inch, 1.8 * inch, 1.95 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_anomaly_section(self, anomaly: Optional[AnomalyModel], styles):
        if not anomaly:
            return None

        data = [
            [
                Paragraph("Flagged Outliers", styles["TableCell"]),
                Paragraph(f"{anomaly.n_anomalies:,} / {anomaly.n_samples:,}", styles["TableCellMono"]),
                Paragraph("Outlier Percentage", styles["TableCell"]),
                Paragraph(f"{anomaly.anomaly_percentage:.2f}%", styles["TableCellMono"]),
            ],
            [
                Paragraph("Decision Boundary", styles["TableCell"]),
                Paragraph(f"{anomaly.threshold_score:.4f}", styles["TableCellMono"]),
                Paragraph("Expected Outlier Rate", styles["TableCell"]),
                Paragraph(f"{(anomaly.contamination * 100):.1f}%", styles["TableCellMono"]),
            ],
            [
                Paragraph("Evaluated Features", styles["TableCell"]),
                Paragraph(", ".join(anomaly.feature_names[:4]), styles["TableCellMono"]),
                Paragraph("Score Range", styles["TableCell"]),
                Paragraph(f"[{anomaly.score_min:.2f}, {anomaly.score_max:.2f}]", styles["TableCellMono"]),
            ],
        ]
        t = Table(data, colWidths=[1.8 * inch, 1.95 * inch, 1.8 * inch, 1.95 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_insights_section(self, insight_report: Optional[InsightReport], styles):
        if not insight_report or not insight_report.insights:
            return None

        rows = [
            [
                Paragraph("Impact", styles["TableHeader"]),
                Paragraph("Domain", styles["TableHeader"]),
                Paragraph("Key Finding & Observed Evidence", styles["TableHeader"]),
            ]
        ]
        for f in insight_report.insights[:6]:
            sev = f.get("severity", "info").upper()
            cat = f.get("category", "general").replace("_", " ").title()
            expl = f.get("polished_explanation") or f.get("explanation", "")
            color_hex = (
                "#E11D48" if sev == "CRITICAL"
                else "#D97706" if sev == "WARNING"
                else "#059669" if sev == "POSITIVE"
                else "#334155"
            )
            rows.append([
                Paragraph(f"<font color='{color_hex}'><strong>{sev}</strong></font>", styles["TableCellBold"]),
                Paragraph(cat, styles["TableCell"]),
                Paragraph(expl, styles["TableCell"]),
            ])

        t = Table(rows, colWidths=[1.1 * inch, 1.6 * inch, 4.8 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        return t

    def _build_recommendations_section(
        self, dataset, cleaning, eda, ml_models, clustering, forecast, anomaly, insight_report, styles
    ):
        recs = []

        if cleaning and cleaning.cleaning_summary:
            cs = cleaning.cleaning_summary
            dups = 0
            imputed = 0
            for step in cs.get("steps_executed", []):
                if step.get("step") == "deduplication":
                    dups = step.get("duplicates_removed", 0)
                elif step.get("step") == "imputation":
                    imputed = step.get("total_imputed", 0)
            if dups > 0 or imputed > 0:
                recs.append(
                    ("Data Hygiene", f"Address data entry quality at the source to mitigate {dups:,} duplicate records and {imputed:,} missing attribute values.")
                )

        if anomaly and anomaly.n_anomalies > 0:
            recs.append(
                ("Anomaly Investigation", f"Review the {anomaly.n_anomalies:,} flagged outlier observations ({anomaly.anomaly_percentage:.1f}% of total) across {', '.join(anomaly.feature_names[:3])} to identify operational exceptions or data collection issues.")
            )

        if clustering and clustering.cluster_profiles:
            recs.append(
                ("Segment Strategy", f"Develop tailored operational workflows aligned to the {clustering.k} identified segment cohorts to maximize differentiated engagement.")
            )

        if ml_models:
            best_m = ml_models[0]
            recs.append(
                ("Model Deployment", f"Deploy top-performing {best_m.algorithm} model for forward predictive scoring on new incoming records targeting '{best_m.target_column}'.")
            )

        if forecast and forecast.forecast_points:
            recs.append(
                ("Forecast Tracking", f"Establish variance monitoring tracking actual values against projected trajectory over the {forecast.forecast_horizon}-period horizon.")
            )

        # Baseline governance recommendation
        recs.append(
            ("Continuous Monitoring", f"Schedule recurring analytical reviews on {dataset.original_filename} to capture distribution drift and maintain model accuracy.")
        )

        rows = [
            [
                Paragraph("Strategic Focus Area", styles["TableHeader"]),
                Paragraph("Recommended Actionable Next Step", styles["TableHeader"]),
            ]
        ]
        for r in recs:
            rows.append([
                Paragraph(f"<strong>{r[0]}</strong>", styles["TableCellBold"]),
                Paragraph(r[1], styles["TableCell"]),
            ])

        t = Table(rows, colWidths=[2.2 * inch, 5.3 * inch])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ])
        )
        return t

    def _generate_ml_chart(self, models: List[MLModel]) -> Optional[Image]:
        if not models:
            return None
        try:
            fig, ax = plt.subplots(figsize=(6.5, 2.0), dpi=150)
            names = [m.algorithm for m in reversed(models[:5])]
            scores = []
            for m in reversed(models[:5]):
                metrics_dict = m.metrics or {} if hasattr(m, "metrics") and isinstance(m.metrics, dict) else {}
                if m.task_type == "regression":
                    r2_val = metrics_dict.get("r2", 0.0)
                    scores.append(max(0.0, float(r2_val) if r2_val is not None else 0.0))
                else:
                    acc_val = metrics_dict.get("accuracy", 0.0)
                    scores.append(float(acc_val) if acc_val is not None else 0.0)

            is_best_flags = [m.is_best for m in reversed(models[:5])]
            bar_colors = ["#4F46E5" if b else "#94A3B8" for b in is_best_flags]

            bars = ax.barh(names, scores, color=bar_colors, height=0.55, edgecolor="none")
            ax.set_xlim(0, max(1.0, max(scores) * 1.15 if scores else 1.0))
            ax.set_xlabel("Primary Performance Metric (R² / Accuracy)", fontsize=8, color="#475569")
            ax.set_title("Machine Learning Benchmark Leaderboard", fontsize=9, fontweight="bold", color="#0F172A", loc="left")
            ax.grid(axis="x", linestyle="--", alpha=0.4, color="#CBD5E1")
            ax.spines["top"].set_visible(False)
            ax.spines["right"].set_visible(False)
            ax.spines["left"].set_color("#CBD5E1")
            ax.spines["bottom"].set_color("#CBD5E1")
            ax.tick_params(axis="both", labelsize=8, colors="#334155")

            for bar, score in zip(bars, scores):
                ax.text(
                    bar.get_width() + 0.02,
                    bar.get_y() + bar.get_height() / 2,
                    f"{score:.3f}",
                    va="center",
                    ha="left",
                    fontsize=8,
                    fontweight="bold",
                    color="#0F172A",
                )

            plt.tight_layout()
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", dpi=150)
            plt.close(fig)
            buf.seek(0)
            return Image(buf, width=6.2 * inch, height=1.9 * inch)
        except Exception as e:
            logger.warning(f"Failed to generate ML benchmark chart: {e}")
            return None

    def _generate_forecast_chart(self, forecast: Optional[ForecastModel]) -> Optional[Image]:
        if not forecast or not forecast.forecast_points:
            return None
        try:
            fig, ax = plt.subplots(figsize=(6.5, 2.0), dpi=150)
            pts = forecast.forecast_points
            steps = list(range(1, len(pts) + 1))
            values = [p.get("forecast", 0.0) for p in pts]
            lower_ci = [p.get("lower_ci", v) for p, v in zip(pts, values)]
            upper_ci = [p.get("upper_ci", v) for p, v in zip(pts, values)]

            ax.plot(steps, values, color="#0284C7", linewidth=2, label="Forecast Trajectory", marker="o", markersize=4)
            ax.fill_between(steps, lower_ci, upper_ci, color="#BAE6FD", alpha=0.45, label="95% Confidence Interval")

            ax.set_title(
                f"Trajectory: {forecast.target_column} (Next {forecast.forecast_horizon} {forecast.frequency} steps)",
                fontsize=9,
                fontweight="bold",
                color="#0F172A",
                loc="left",
            )
            ax.set_xlabel("Horizon Step", fontsize=8, color="#475569")
            ax.set_ylabel(forecast.target_column, fontsize=8, color="#475569")
            ax.grid(True, linestyle="--", alpha=0.4, color="#CBD5E1")
            ax.spines["top"].set_visible(False)
            ax.spines["right"].set_visible(False)
            ax.spines["left"].set_color("#CBD5E1")
            ax.spines["bottom"].set_color("#CBD5E1")
            ax.tick_params(axis="both", labelsize=8, colors="#334155")
            ax.legend(fontsize=7, loc="upper left", frameon=False)

            plt.tight_layout()
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", dpi=150)
            plt.close(fig)
            buf.seek(0)
            return Image(buf, width=6.2 * inch, height=1.9 * inch)
        except Exception as e:
            logger.warning(f"Failed to generate forecast chart: {e}")
            return None

    def _generate_clustering_chart(self, clustering: Optional[ClusteringModel]) -> Optional[Image]:
        if not clustering or not clustering.cluster_profiles:
            return None
        try:
            fig, ax = plt.subplots(figsize=(6.5, 1.8), dpi=150)
            profiles = clustering.cluster_profiles
            names = [p.get("name", f"Cluster {p.get('cluster_id')}")[:18] for p in profiles]
            sizes = [p.get("size", 0) for p in profiles]
            palette = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"]
            bar_colors = [palette[i % len(palette)] for i in range(len(sizes))]

            bars = ax.bar(names, sizes, color=bar_colors, width=0.5, edgecolor="none")
            ax.set_title(
                f"Cluster Segment Population Distribution (K={clustering.k}, Silhouette={clustering.silhouette_score:.2f})",
                fontsize=9,
                fontweight="bold",
                color="#0F172A",
                loc="left",
            )
            ax.set_ylabel("Entity Count", fontsize=8, color="#475569")
            ax.grid(axis="y", linestyle="--", alpha=0.4, color="#CBD5E1")
            ax.spines["top"].set_visible(False)
            ax.spines["right"].set_visible(False)
            ax.spines["left"].set_color("#CBD5E1")
            ax.spines["bottom"].set_color("#CBD5E1")
            ax.tick_params(axis="both", labelsize=8, colors="#334155")

            for bar in bars:
                height = bar.get_height()
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    height + max(sizes) * 0.02,
                    f"{int(height):,}",
                    ha="center",
                    va="bottom",
                    fontsize=8,
                    fontweight="bold",
                    color="#0F172A",
                )

            plt.tight_layout()
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", dpi=150)
            plt.close(fig)
            buf.seek(0)
            return Image(buf, width=6.2 * inch, height=1.7 * inch)
        except Exception as e:
            logger.warning(f"Failed to generate clustering chart: {e}")
            return None

    def _generate_anomaly_chart(self, anomaly: Optional[AnomalyModel]) -> Optional[Image]:
        if not anomaly:
            return None
        try:
            fig, ax = plt.subplots(figsize=(6.5, 1.3), dpi=150)
            normal_count = anomaly.n_samples - anomaly.n_anomalies
            categories = ["Normal Records", "Anomalous Outliers"]
            counts = [normal_count, anomaly.n_anomalies]
            bar_colors = ["#10B981", "#E11D48"]

            bars = ax.barh(categories, counts, color=bar_colors, height=0.45, edgecolor="none")
            ax.set_title(
                f"Outlier Diagnostic: {anomaly.n_anomalies} Anomalies ({anomaly.anomaly_percentage:.1f}%) Flagged",
                fontsize=9,
                fontweight="bold",
                color="#0F172A",
                loc="left",
            )
            ax.set_xlabel("Observations", fontsize=8, color="#475569")
            ax.grid(axis="x", linestyle="--", alpha=0.4, color="#CBD5E1")
            ax.spines["top"].set_visible(False)
            ax.spines["right"].set_visible(False)
            ax.spines["left"].set_color("#CBD5E1")
            ax.spines["bottom"].set_color("#CBD5E1")
            ax.tick_params(axis="both", labelsize=8, colors="#334155")

            for bar in bars:
                width = bar.get_width()
                ax.text(
                    width + max(counts) * 0.02,
                    bar.get_y() + bar.get_height() / 2,
                    f"{int(width):,}",
                    va="center",
                    ha="left",
                    fontsize=8,
                    fontweight="bold",
                    color="#0F172A",
                )

            plt.tight_layout()
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", dpi=150)
            plt.close(fig)
            buf.seek(0)
            return Image(buf, width=6.2 * inch, height=1.3 * inch)
        except Exception as e:
            logger.warning(f"Failed to generate anomaly chart: {e}")
            return None

    def _load_dataset_df(self, dataset: Dataset, use_cleaned: bool = True) -> Optional[pd.DataFrame]:
        file_path = dataset.cleaned_file_path if (use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path) else dataset.file_path
        if not file_path or not os.path.exists(file_path):
            file_path = dataset.file_path

        if not file_path or not os.path.exists(file_path):
            return None

        try:
            return pd.read_csv(file_path)
        except Exception as err:
            logger.error(f"Failed to read CSV for report generation: {err}")
            return None


report_service = ReportGenerationService()
