import os
import uuid
import warnings
from datetime import datetime, timedelta
from typing import Any, Optional
import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from statsmodels.tsa.arima.model import ARIMA

from app.core.config import settings
from app.models.forecasting import ForecastModel
from app.repositories.dataset_repository import dataset_repository
from app.repositories.forecasting_repository import forecasting_repository
from app.schemas.forecasting import (
    ForecastEvaluationRequest,
    ForecastEvaluationResponse,
    ForecastingColumnsResponse,
    ForecastMetrics,
    ForecastModelResponse,
    ForecastRunRequest,
    ForecastValidationPoint,
    FutureForecastPoint,
    TimeSeriesDateColumnInfo,
    TimeSeriesNumericColumnInfo,
    TimeSeriesPoint,
)
from app.services.validation_service import validation_service

# Suppress statsmodels frequency warnings
warnings.filterwarnings("ignore", category=UserWarning, module="statsmodels")


class ForecastingService:
    """Service providing time series inspection, chronological train/validation backtesting,

    ARIMA model fitting, future forecasts with confidence intervals, and model persistence.
    """

    def inspect_forecasting_columns(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        use_cleaned: bool = True,
    ) -> ForecastingColumnsResponse:
        """Inspects dataset columns to detect parseable datetime columns and numeric metric candidates."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        file_path = (
            dataset.cleaned_file_path
            if (use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
            else dataset.file_path
        )
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)

        date_columns: list[TimeSeriesDateColumnInfo] = []
        numeric_columns: list[TimeSeriesNumericColumnInfo] = []

        for col in df.columns:
            col_name = str(col)
            series = df[col].dropna()

            # Check if column is datetime or parseable as dates
            is_date = False
            parsed_series = None

            if pd.api.types.is_datetime64_any_dtype(df[col]):
                is_date = True
                parsed_series = pd.to_datetime(df[col], errors="coerce").dropna()
            elif pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col]):
                # Sample first 20 non-null values to test date parseability
                sample = series.head(20)
                if len(sample) > 0:
                    parsed_sample = pd.to_datetime(sample, errors="coerce")
                    if parsed_sample.notna().mean() >= 0.8:
                        is_date = True
                        parsed_series = pd.to_datetime(series, errors="coerce").dropna()

            if is_date and parsed_series is not None and len(parsed_series) > 0:
                sorted_dates = parsed_series.sort_values().drop_duplicates()
                inferred_freq = pd.infer_freq(sorted_dates) if len(sorted_dates) > 2 else None

                min_str = sorted_dates.iloc[0].strftime("%Y-%m-%d")
                max_str = sorted_dates.iloc[-1].strftime("%Y-%m-%d")
                samples_str = [str(x)[:19] for x in series.head(3)]

                date_columns.append(
                    TimeSeriesDateColumnInfo(
                        name=col_name,
                        non_null_count=int(series.count()),
                        missing_count=int(df[col].isna().sum()),
                        sample_values=samples_str,
                        min_date=min_str,
                        max_date=max_str,
                        inferred_frequency=inferred_freq,
                    )
                )

            # Check if column is numeric target candidate
            if pd.api.types.is_numeric_dtype(df[col]):
                non_null = int(series.count())
                missing = int(df[col].isna().sum())
                mean_val = float(series.mean()) if non_null > 0 else None
                min_val = float(series.min()) if non_null > 0 else None
                max_val = float(series.max()) if non_null > 0 else None

                numeric_columns.append(
                    TimeSeriesNumericColumnInfo(
                        name=col_name,
                        data_type=str(df[col].dtype),
                        non_null_count=non_null,
                        missing_count=missing,
                        mean=mean_val,
                        min=min_val,
                        max=max_val,
                    )
                )

        # Select recommended columns
        recommended_date: Optional[str] = date_columns[0].name if date_columns else None

        # Exclude IDs from recommended target
        recommended_target: Optional[str] = None
        for nc in numeric_columns:
            col_l = nc.name.lower()
            if col_l != "id" and not col_l.endswith("_id") and nc.name != recommended_date:
                recommended_target = nc.name
                break
        if not recommended_target and numeric_columns:
            recommended_target = numeric_columns[0].name

        return ForecastingColumnsResponse(
            dataset_id=dataset_id,
            is_cleaned=bool(use_cleaned and dataset.has_cleaned),
            total_rows=len(df),
            date_columns=date_columns,
            numeric_columns=numeric_columns,
            recommended_date_column=recommended_date,
            recommended_target_column=recommended_target,
        )

    def _prepare_time_series(
        self,
        df: pd.DataFrame,
        date_column: str,
        target_column: str,
        requested_freq: Optional[str] = None,
    ) -> tuple[pd.Series, str]:
        """Validates date and numeric columns, cleans missing values, aggregates duplicates,

        sorts strictly chronologically (no random shuffle), regularizes frequency, and interpolates gaps.
        Returns:
            ts: Clean chronological pd.Series with DatetimeIndex
            freq_str: String representation of frequency
        """
        if date_column not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Date column '{date_column}' does not exist in dataset.",
            )

        if target_column not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{target_column}' does not exist in dataset.",
            )

        # Check numeric target
        if not pd.api.types.is_numeric_dtype(df[target_column]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{target_column}' is not numeric and cannot be used for time series forecasting.",
            )

        # Parse date column
        try:
            parsed_dates = pd.to_datetime(df[date_column], errors="coerce")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Date column '{date_column}' failed datetime conversion: {str(e)}",
            )

        if parsed_dates.isna().mean() > 0.5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Date column '{date_column}' contains invalid or unparseable timestamps (>50% non-dates).",
            )

        # Create working dataframe and drop rows missing date or target
        working_df = pd.DataFrame({
            "ds": parsed_dates,
            "y": pd.to_numeric(df[target_column], errors="coerce"),
        }).dropna(subset=["ds", "y"])

        if len(working_df) < 15:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient observations for time series forecasting (minimum 15 observations required, got {len(working_df)}).",
            )

        # Aggregate duplicates chronologically by mean
        deduped = working_df.groupby("ds")["y"].mean().reset_index()

        # Sort strictly chronologically — NEVER shuffle time series data!
        deduped = deduped.sort_values(by="ds").reset_index(drop=True)

        # Set DatetimeIndex
        ts = pd.Series(data=deduped["y"].values, index=pd.DatetimeIndex(deduped["ds"]))

        # Frequency detection and gap handling
        inferred = pd.infer_freq(ts.index)
        freq_str = requested_freq or inferred or "D"

        try:
            # Resample to ensure equidistant steps and handle gaps appropriately
            resampled = ts.resample(freq_str).mean()
            # Linear interpolation for internal gaps + forward/backward fill for boundary edge cases
            ts_clean = resampled.interpolate(method="time").bfill().ffill()
        except Exception:
            # Fallback if frequency resampling encounters an issue
            freq_str = "D"
            ts_clean = ts.copy()

        # Ensure numeric float type and no remaining NaNs
        ts_clean = ts_clean.astype(float).dropna()

        if len(ts_clean) < 15:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"After time series regularizing and gap-handling, only {len(ts_clean)} observations remain (minimum 15 required).",
            )

        return ts_clean, freq_str

    def _fit_best_arima(self, train_series: pd.Series) -> tuple[Any, tuple[int, int, int]]:
        """Fits candidate ARIMA(p, d, q) orders and selects the model minimizing AIC."""
        candidate_orders = [
            (1, 1, 1),
            (1, 0, 1),
            (2, 1, 1),
            (0, 1, 1),
            (1, 1, 0),
            (2, 1, 2),
        ]

        best_model = None
        best_aic = float("inf")
        best_order = (1, 1, 1)

        for order in candidate_orders:
            try:
                model = ARIMA(train_series, order=order)
                fitted = model.fit()
                if fitted.aic < best_aic and not np.isnan(fitted.aic):
                    best_aic = fitted.aic
                    best_model = fitted
                    best_order = order
            except Exception:
                continue

        if best_model is None:
            # Fallback to simple (1, 1, 0)
            model = ARIMA(train_series, order=(1, 1, 0))
            best_model = model.fit()
            best_order = (1, 1, 0)

        return best_model, best_order

    def _calculate_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> ForecastMetrics:
        """Calculates time series forecast evaluation metrics: MAPE, RMSE, MAE, R2, and Directional Accuracy."""
        # Mean Absolute Percentage Error (MAPE) with epsilon protection against division by zero
        eps = 1e-8
        mape_val = float(np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + eps))) * 100)
        mape_val = round(min(mape_val, 999.9), 2)  # Cap extreme percentages for readability

        # Root Mean Squared Error (RMSE)
        rmse_val = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

        # Mean Absolute Error (MAE)
        mae_val = float(np.mean(np.abs(y_true - y_pred)))

        # R² on validation period
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        r2_val = float(1 - (ss_res / (ss_tot + eps))) if ss_tot > 0 else None

        # Directional Accuracy (percentage of correct movement signs)
        dir_acc = None
        if len(y_true) > 1:
            true_diff = np.diff(y_true)
            pred_diff = np.diff(y_pred)
            same_dir = np.sign(true_diff) == np.sign(pred_diff)
            dir_acc = round(float(np.mean(same_dir) * 100), 2)

        return ForecastMetrics(
            mape=round(mape_val, 2),
            rmse=round(rmse_val, 4),
            mae=round(mae_val, 4),
            r2=round(r2_val, 4) if r2_val is not None else None,
            validation_horizon=len(y_true),
            direction_accuracy=dir_acc,
        )

    def evaluate_forecasting(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        request: ForecastEvaluationRequest,
    ) -> ForecastEvaluationResponse:
        """Executes a chronological train/validation backtest to evaluate forecast accuracy without saving a model."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        file_path = (
            dataset.cleaned_file_path
            if (request.use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
            else dataset.file_path
        )
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)
        ts_clean, freq_str = self._prepare_time_series(
            df=df,
            date_column=request.date_column,
            target_column=request.target_column,
            requested_freq=request.frequency,
        )

        n_samples = len(ts_clean)
        val_horizon = min(request.forecast_horizon, max(3, int(n_samples * 0.25)))

        if val_horizon >= n_samples - 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Forecast horizon ({request.forecast_horizon}) is too large relative to historical sample size ({n_samples}).",
            )

        # Chronological train/validation split — strictly maintain temporal ordering
        train_ts = ts_clean.iloc[:-val_horizon]
        val_ts = ts_clean.iloc[-val_horizon:]

        # Fit ARIMA model on training partition
        fitted_model, best_order = self._fit_best_arima(train_ts)

        # Predict across validation period
        forecast_res = fitted_model.get_forecast(steps=val_horizon)
        val_preds = forecast_res.predicted_mean.values
        conf_int = forecast_res.conf_int(alpha=0.05).values

        metrics = self._calculate_metrics(val_ts.values, val_preds)

        validation_points: list[ForecastValidationPoint] = []
        for idx in range(val_horizon):
            date_str = str(val_ts.index[idx].strftime("%Y-%m-%d %H:%M:%S")).replace(" 00:00:00", "")
            actual_val = round(float(val_ts.values[idx]), 4)
            pred_val = round(float(val_preds[idx]), 4)
            lower = round(float(conf_int[idx, 0]), 4) if conf_int.shape[1] > 0 else None
            upper = round(float(conf_int[idx, 1]), 4) if conf_int.shape[1] > 1 else None

            validation_points.append(
                ForecastValidationPoint(
                    date=date_str,
                    actual=actual_val,
                    predicted=pred_val,
                    lower_ci=lower,
                    upper_ci=upper,
                )
            )

        notes = (
            f"ARIMA{best_order} model evaluated via chronological rolling backtest over {val_horizon} holdout periods. "
            f"Achieved MAPE of {metrics.mape}% and RMSE of {metrics.rmse}."
        )

        return ForecastEvaluationResponse(
            date_column=request.date_column,
            target_column=request.target_column,
            frequency=freq_str,
            n_historical_points=n_samples,
            validation_horizon=val_horizon,
            metrics=metrics,
            validation_points=validation_points,
            summary_notes=notes,
        )

    def run_forecasting(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
        request: ForecastRunRequest,
    ) -> ForecastModel:
        """Trains final time series model, generates future forecasts with confidence bounds,

        persists artifact via joblib, and records model in database.
        """
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )

        file_path = (
            dataset.cleaned_file_path
            if (request.use_cleaned and dataset.has_cleaned and dataset.cleaned_file_path and os.path.exists(dataset.cleaned_file_path))
            else dataset.file_path
        )
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file does not exist on storage.",
            )

        df = validation_service.read_dataset_df(file_path)
        ts_clean, freq_str = self._prepare_time_series(
            df=df,
            date_column=request.date_column,
            target_column=request.target_column,
            requested_freq=request.frequency,
        )

        n_samples = len(ts_clean)
        val_horizon = min(request.forecast_horizon, max(3, int(n_samples * 0.25)))

        # 1. Backtesting on holdout validation period for honest evaluation metrics
        train_ts = ts_clean.iloc[:-val_horizon]
        val_ts = ts_clean.iloc[-val_horizon:]
        val_model, val_order = self._fit_best_arima(train_ts)

        val_res = val_model.get_forecast(steps=val_horizon)
        val_preds = val_res.predicted_mean.values
        val_conf_int = val_res.conf_int(alpha=0.05).values
        metrics = self._calculate_metrics(val_ts.values, val_preds)

        validation_points: list[dict[str, Any]] = []
        for idx in range(val_horizon):
            d_str = str(val_ts.index[idx].strftime("%Y-%m-%d %H:%M:%S")).replace(" 00:00:00", "")
            validation_points.append({
                "date": d_str,
                "actual": round(float(val_ts.values[idx]), 4),
                "predicted": round(float(val_preds[idx]), 4),
                "lower_ci": round(float(val_conf_int[idx, 0]), 4),
                "upper_ci": round(float(val_conf_int[idx, 1]), 4),
            })

        # 2. Fit final model on 100% of historical observations
        final_model, final_order = self._fit_best_arima(ts_clean)

        # 3. Generate future forecast for the requested horizon
        future_res = final_model.get_forecast(steps=request.forecast_horizon)
        future_preds = future_res.predicted_mean.values
        future_ci = future_res.conf_int(alpha=0.05).values

        # Generate future dates
        last_date = ts_clean.index[-1]
        try:
            future_dates = pd.date_range(start=last_date, periods=request.forecast_horizon + 1, freq=freq_str)[1:]
        except Exception:
            # Fallback simple timedelta
            future_dates = [last_date + timedelta(days=i + 1) for i in range(request.forecast_horizon)]

        forecast_points: list[dict[str, Any]] = []
        for idx in range(request.forecast_horizon):
            f_date_str = str(future_dates[idx].strftime("%Y-%m-%d %H:%M:%S")).replace(" 00:00:00", "")
            f_val = round(float(future_preds[idx]), 4)
            lower = round(float(future_ci[idx, 0]), 4)
            upper = round(float(future_ci[idx, 1]), 4)

            forecast_points.append({
                "date": f_date_str,
                "forecast": f_val,
                "lower_ci": lower,
                "upper_ci": upper,
            })

        # Format historical points (capped at last 150 points for fast payload transfer)
        hist_subset = ts_clean.tail(150)
        historical_points: list[dict[str, Any]] = [
            {
                "date": str(idx.strftime("%Y-%m-%d %H:%M:%S")).replace(" 00:00:00", ""),
                "value": round(float(val), 4),
            }
            for idx, val in zip(hist_subset.index, hist_subset.values)
        ]

        # Persist model artifact using joblib
        os.makedirs(settings.MODELS_DIR, exist_ok=True)
        artifact_filename = f"forecast_{uuid.uuid4().hex}.joblib"
        artifact_path = os.path.join(settings.MODELS_DIR, artifact_filename)
        joblib.dump(final_model, artifact_path)

        model_name = request.name or f"ARIMA{final_order} Forecast ({request.forecast_horizon} Steps)"

        model_params = {
            "model_type": "ARIMA",
            "order": list(final_order),
            "aic": round(float(final_model.aic), 2) if not np.isnan(final_model.aic) else None,
            "bic": round(float(final_model.bic), 2) if not np.isnan(final_model.bic) else None,
        }

        # Persist in database
        forecast_model = forecasting_repository.create(
            db=db,
            dataset_id=dataset_id,
            user_id=user_id,
            name=model_name,
            date_column=request.date_column,
            target_column=request.target_column,
            forecast_horizon=request.forecast_horizon,
            frequency=freq_str,
            use_cleaned=bool(request.use_cleaned and dataset.has_cleaned),
            n_historical_points=n_samples,
            metrics=metrics.model_dump(),
            model_parameters=model_params,
            historical_points=historical_points,
            validation_points=validation_points,
            forecast_points=forecast_points,
            artifact_path=artifact_path,
            status="completed",
        )

        return forecast_model

    def get_forecast_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> ForecastModel:
        """Retrieves a specific forecast model with strict user ownership validation."""
        model = forecasting_repository.get_by_id_and_user(db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Forecast model not found or access denied.",
            )
        return model

    def list_dataset_models(
        self,
        db: Session,
        dataset_id: int,
        user_id: int,
    ) -> list[ForecastModel]:
        """Lists all forecast models for a dataset with strict tenant ownership validation."""
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found or access denied.",
            )
        return forecasting_repository.list_by_dataset(db, dataset_id=dataset_id, user_id=user_id)

    def delete_forecast_model(
        self,
        db: Session,
        model_id: int,
        user_id: int,
    ) -> None:
        """Deletes a forecast model and removes its on-disk serialized artifact."""
        model = forecasting_repository.get_by_id_and_user(db, model_id=model_id, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Forecast model not found or access denied.",
            )

        if model.artifact_path and os.path.exists(model.artifact_path):
            try:
                os.remove(model.artifact_path)
            except OSError:
                pass

        forecasting_repository.delete(db, model)


forecasting_service = ForecastingService()
