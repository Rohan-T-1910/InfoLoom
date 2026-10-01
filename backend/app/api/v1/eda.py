from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.eda import (
    CorrelationMatrixResponse,
    EDARequestConfig,
    EDAResponse,
    FeatureImportanceResponse,
)
from app.services.eda_service import eda_service

router = APIRouter(prefix="/datasets/{dataset_id}/eda", tags=["EDA"])


@router.get(
    "",
    response_model=EDAResponse,
    summary="Get complete EDA analysis report (KPIs, stats, correlations, distributions, feature importance)",
)
def get_eda_report(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    target_column: Annotated[Optional[str], Query(description="Target column for feature importance")] = None,
    use_cleaned: Annotated[bool, Query(description="Analyze cleaned data if available")] = True,
    force_refresh: Annotated[bool, Query(description="Bypass cache and force recomputation")] = False,
):
    """
    Executes full Exploratory Data Analysis (EDA) or retrieves cached result:
    - Overall dataset KPIs and memory profiling
    - Parametric and non-parametric summary statistics
    - Correlation matrix with collinearity flags
    - Numerical histograms and categorical distributions
    - Baseline ML feature importance
    """
    return eda_service.run_eda(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        target_column=target_column,
        use_cleaned=use_cleaned,
        force_refresh=force_refresh,
    )


@router.post(
    "/refresh",
    response_model=EDAResponse,
    summary="Force refresh EDA analysis report bypassing cache",
)
def refresh_eda_report(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    config: Optional[EDARequestConfig] = None,
):
    """Bypasses existing cache and generates fresh EDA calculations."""
    target_col = config.target_column if config else None
    use_cleaned = config.use_cleaned if config else True

    return eda_service.run_eda(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        target_column=target_col,
        use_cleaned=use_cleaned,
        force_refresh=True,
    )


@router.get(
    "/correlations",
    response_model=CorrelationMatrixResponse,
    summary="Get correlation matrix and collinearity warnings",
)
def get_correlations(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    use_cleaned: Annotated[bool, Query(description="Analyze cleaned data if available")] = True,
):
    """Calculates numerical correlation matrix and highlights strong correlation pairs."""
    eda = eda_service.run_eda(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        use_cleaned=use_cleaned,
        force_refresh=False,
    )
    return eda.correlation_matrix


@router.get(
    "/feature-importance",
    response_model=Optional[FeatureImportanceResponse],
    summary="Get baseline ML feature importance",
)
def get_feature_importance(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    target_column: Annotated[Optional[str], Query(description="Target column")] = None,
    use_cleaned: Annotated[bool, Query(description="Analyze cleaned data if available")] = True,
):
    """Calculates feature importance ranking using a baseline Random Forest model."""
    eda = eda_service.run_eda(
        db=db,
        dataset_id=dataset_id,
        user_id=current_user.id,
        target_column=target_column,
        use_cleaned=use_cleaned,
        force_refresh=False,
    )
    return eda.feature_importance
