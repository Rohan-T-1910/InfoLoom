from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.eda import router as eda_router
from app.api.v1.ml import router as ml_router
from app.api.v1.clustering import router as clustering_router
from app.api.v1.forecasting import router as forecasting_router
from app.api.v1.anomaly import router as anomaly_router
from app.api.v1.insights import router as insights_router
from app.api.v1.reports import router as reports_router
from app.api.v1.model_registry import router as model_registry_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(datasets_router)
api_router.include_router(eda_router)
api_router.include_router(ml_router)
api_router.include_router(clustering_router)
api_router.include_router(forecasting_router)
api_router.include_router(anomaly_router)
api_router.include_router(insights_router)
api_router.include_router(reports_router)
api_router.include_router(model_registry_router)

