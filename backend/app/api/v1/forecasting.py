from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.forecasting import (
    ForecastEvaluationRequest,
    ForecastEvaluationResponse,
    ForecastingColumnsResponse,
    ForecastModelResponse,
    ForecastModelSummary,
    ForecastRunRequest,
)
from app.services.forecasting_service import forecasting_service

router = APIRouter(tags=["Time Series Forecasting"])


@router.get(
    "/datasets/{dataset_id}/forecasting/columns",
    response_model=ForecastingColumnsResponse,
    summary="Inspect and validate dataset for datetime and numeric target columns",
)
def inspect_forecasting_columns(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    use_cleaned: Annotated[bool, Query(description="Analyze cleaned data if available")] = True,
):
    """Identifies candidate date/time columns (with range and frequency) and numeric metrics suitable for time series forecasting."""
    return forecasting_service.inspect_forecasting_columns(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        use_cleaned=use_cleaned,
    )


@router.post(
    "/datasets/{dataset_id}/forecasting/evaluate",
    response_model=ForecastEvaluationResponse,
    summary="Evaluate forecasting configuration via chronological rolling backtest",
)
def evaluate_forecasting(
    dataset_id: int,
    request: ForecastEvaluationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Executes time-aware train/validation split without future lookahead, computing MAPE, RMSE, MAE, and backtest points."""
    return forecasting_service.evaluate_forecasting(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        request=request,
    )


@router.post(
    "/datasets/{dataset_id}/forecasting/run",
    response_model=ForecastModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Train ARIMA time series model, forecast future horizon, and persist artifact",
)
def run_forecasting(
    dataset_id: int,
    request: ForecastRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Fits time series model on historical observations, predicts future steps with 95% confidence intervals, and stores artifacts."""
    return forecasting_service.run_forecasting(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        request=request,
    )


@router.get(
    "/datasets/{dataset_id}/forecasting/results",
    response_model=list[ForecastModelSummary],
    summary="List all forecast models and runs for a dataset",
)
def list_dataset_forecast_models(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieves all past forecasting runs for the specified dataset."""
    return forecasting_service.list_dataset_models(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
    )


@router.get(
    "/forecasting/models/{model_id}",
    response_model=ForecastModelResponse,
    summary="Get detailed forecast model with historical actuals, validation backtest, and future forecasts",
)
def get_forecast_model(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieves full forecast series, confidence bands, evaluation metrics, and model parameters."""
    return forecasting_service.get_forecast_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )


@router.delete(
    "/forecasting/models/{model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a forecast model and serialized artifact",
)
def delete_forecast_model(
    model_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Deletes a forecasting model and frees on-disk artifact storage."""
    forecasting_service.delete_forecast_model(
        db=db,
        model_id=model_id,
        user_id=current_user.id,
    )
