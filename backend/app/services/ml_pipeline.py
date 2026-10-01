import os
from typing import Any, Optional
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import KFold, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler
from xgboost import XGBClassifier, XGBRegressor

class MLPipelineBuilder:
    """
    Constructs robust, leak-free scikit-learn training pipelines with:
    - ColumnTransformer separation of numerical and categorical feature streams
    - Imputation and scaling strictly learned from the training split
    - Multi-algorithm support (Linear, Logistic, Random Forest, XGBoost)
    - Cross-validation and standardized evaluation metrics
    """

    @staticmethod
    def identify_feature_types(
        df: pd.DataFrame, feature_columns: list[str]
    ) -> tuple[list[str], list[str]]:
        """Separates feature column names into numeric and categorical lists."""
        numeric_features: list[str] = []
        categorical_features: list[str] = []

        for col in feature_columns:
            if col not in df.columns:
                continue
            if pd.api.types.is_numeric_dtype(df[col]):
                numeric_features.append(col)
            else:
                categorical_features.append(col)

        return numeric_features, categorical_features

    @staticmethod
    def build_preprocessor(
        numeric_features: list[str], categorical_features: list[str]
    ) -> ColumnTransformer:
        """
        Builds a scikit-learn ColumnTransformer that encapsulates:
        - Numerical: median imputation + StandardScaler
        - Categorical: constant string imputation + OneHotEncoder(handle_unknown='ignore')
        """
        transformers = []

        if numeric_features:
            numeric_transformer = Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]
            )
            transformers.append(("num", numeric_transformer, numeric_features))

        if categorical_features:
            categorical_transformer = Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                ]
            )
            transformers.append(("cat", categorical_transformer, categorical_features))

        return ColumnTransformer(transformers=transformers, remainder="drop")

    @staticmethod
    def instantiate_model(task_type: str, algorithm: str) -> tuple[str, Any, dict[str, Any]]:
        """Instantiates algorithm estimator and returns (display_name, estimator, default_hyperparameters)."""
        algo_lower = algorithm.lower().replace(" ", "_")

        if task_type == "regression":
            if algo_lower in ("linear", "linear_regression", "lr"):
                name = "Linear Regression"
                model = LinearRegression()
                params = {"fit_intercept": True}
            elif algo_lower in ("xgboost", "xgb", "xgboost_regressor"):
                name = "XGBoost Regressor"
                model = XGBRegressor(
                    n_estimators=100,
                    max_depth=6,
                    learning_rate=0.1,
                    random_state=42,
                    eval_metric="rmse",
                    verbosity=0,
                )
                params = {"n_estimators": 100, "max_depth": 6, "learning_rate": 0.1}
            else:
                from sklearn.ensemble import RandomForestRegressor
                name = "Random Forest Regressor"
                model = RandomForestRegressor(
                    n_estimators=100,
                    max_depth=12,
                    random_state=42,
                    n_jobs=-1,
                )
                params = {"n_estimators": 100, "max_depth": 12}
            return name, model, params

        else:
            # Classification
            if algo_lower in ("logistic", "logistic_regression", "lr"):
                name = "Logistic Regression"
                model = LogisticRegression(max_iter=1000, random_state=42)
                params = {"max_iter": 1000, "solver": "lbfgs"}
            elif algo_lower in ("xgboost", "xgb", "xgboost_classifier"):
                name = "XGBoost Classifier"
                model = XGBClassifier(
                    n_estimators=100,
                    max_depth=6,
                    learning_rate=0.1,
                    random_state=42,
                    eval_metric="logloss",
                    verbosity=0,
                )
                params = {"n_estimators": 100, "max_depth": 6, "learning_rate": 0.1}
            else:
                from sklearn.ensemble import RandomForestClassifier
                name = "Random Forest Classifier"
                model = RandomForestClassifier(
                    n_estimators=100,
                    max_depth=12,
                    random_state=42,
                    n_jobs=-1,
                )
                params = {"n_estimators": 100, "max_depth": 12}
            return name, model, params

    @classmethod
    def train_and_evaluate(
        cls,
        task_type: str,
        algorithm: str,
        X_train: pd.DataFrame,
        X_test: pd.DataFrame,
        y_train: np.ndarray,
        y_test: np.ndarray,
        numeric_features: list[str],
        categorical_features: list[str],
        cv_folds: int = 5,
        target_classes: Optional[list[Any]] = None,
    ) -> tuple[str, Pipeline, dict[str, Any], dict[str, Any]]:
        """
        Constructs full end-to-end Pipeline, trains exclusively on train split,
        evaluates cross-validation, and computes test set performance metrics.
        """
        name, estimator, hyperparameters = cls.instantiate_model(task_type, algorithm)

        preprocessor = cls.build_preprocessor(numeric_features, categorical_features)
        full_pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("model", estimator)])

        # 1. Cross-validation strictly on training split to prevent test set data leakage
        scoring = "r2" if task_type == "regression" else "accuracy"
        cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42) if task_type == "regression" else StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)

        try:
            cv_scores = cross_val_score(full_pipeline, X_train, y_train, cv=cv, scoring=scoring)
            cv_mean = float(round(np.mean(cv_scores), 4))
            cv_std = float(round(np.std(cv_scores), 4))
            cv_scores_list = [float(round(s, 4)) for s in cv_scores]
        except Exception:
            cv_mean = 0.0
            cv_std = 0.0
            cv_scores_list = []

        # 2. Fit full pipeline on train split
        full_pipeline.fit(X_train, y_train)

        # 3. Predict on holdout test set
        y_pred = full_pipeline.predict(X_test)

        metrics: dict[str, Any] = {
            "cv_mean": cv_mean,
            "cv_std": cv_std,
            "cv_scores": cv_scores_list,
        }

        if task_type == "regression":
            rmse = float(round(np.sqrt(mean_squared_error(y_test, y_pred)), 4))
            mae = float(round(mean_absolute_error(y_test, y_pred), 4))
            r2 = float(round(r2_score(y_test, y_pred), 4))

            metrics.update({
                "rmse": rmse,
                "mae": mae,
                "r2": r2,
                "primary_metric": r2,
                "primary_metric_name": "R² Score",
            })
        else:
            acc = float(round(accuracy_score(y_test, y_pred), 4))
            precision = float(round(precision_score(y_test, y_pred, average="weighted", zero_division=0), 4))
            recall = float(round(recall_score(y_test, y_pred, average="weighted", zero_division=0), 4))
            f1 = float(round(f1_score(y_test, y_pred, average="weighted", zero_division=0), 4))

            # ROC-AUC calculation when probability output is available
            roc_auc = None
            if hasattr(full_pipeline, "predict_proba"):
                try:
                    y_proba = full_pipeline.predict_proba(X_test)
                    if len(np.unique(y_test)) == 2 and y_proba.shape[1] >= 2:
                        roc_auc = float(round(roc_auc_score(y_test, y_proba[:, 1]), 4))
                    elif len(np.unique(y_test)) > 2:
                        roc_auc = float(round(roc_auc_score(y_test, y_proba, multi_class="ovr", average="weighted"), 4))
                except Exception:
                    roc_auc = None

            metrics.update({
                "accuracy": acc,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "roc_auc": roc_auc,
                "primary_metric": f1,
                "primary_metric_name": "F1 Score",
            })

        return name, full_pipeline, metrics, hyperparameters
