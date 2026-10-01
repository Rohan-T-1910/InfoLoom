# InfoLoom Phase 3 API Specification: Exploratory Data Analysis (EDA) & Caching

Base URL: `/api/v1/datasets`

All endpoints require Bearer JWT authentication via `Authorization: Bearer <token>` and enforce strict multi-tenant dataset ownership.

---

## 1. Full Exploratory Data Analysis (EDA)
- **Method**: `GET`
- **Path**: `/api/v1/datasets/{dataset_id}/eda`
- **Query Parameters**:
  - `target_column` (string, optional): Target feature for evaluating baseline feature importance.
  - `use_cleaned` (boolean, default: `true`): Whether to analyze cleaned dataset artifact if available.
  - `force_refresh` (boolean, default: `false`): Bypasses cached report and recalculates EDA.
- **Description**: Computes or retrieves cached comprehensive statistical profiling:
  - Dataset KPIs & memory usage
  - Parametric moments (mean, std, skewness, kurtosis) and non-parametric percentiles (median, IQR)
  - Pearson correlation matrix with collinearity flags
  - Univariate distribution histograms & categorical frequency bars
  - Baseline Random Forest feature importance ranking
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "dataset_id": 1,
    "is_cleaned": true,
    "target_column": "churn",
    "kpis": {
      "row_count": 1000,
      "column_count": 6,
      "total_cells": 6000,
      "missing_cells": 0,
      "missing_percentage": 0.0,
      "duplicate_rows": 0,
      "duplicate_percentage": 0.0,
      "numeric_columns_count": 4,
      "categorical_columns_count": 2,
      "memory_bytes": 48200,
      "memory_human": "47.07 KB"
    },
    "summary_statistics": {
      "income": {
        "data_type": "numeric",
        "count": 1000,
        "missing_count": 0,
        "missing_percentage": 0.0,
        "mean": 74500.25,
        "std": 18200.1,
        "min": 32000.0,
        "q25": 58000.0,
        "median": 72000.0,
        "q75": 89000.0,
        "max": 165000.0,
        "iqr": 31000.0,
        "skewness": 0.38,
        "kurtosis": -0.15,
        "zeros_count": 0,
        "zeros_percentage": 0.0
      },
      "department": {
        "data_type": "categorical",
        "count": 1000,
        "missing_count": 0,
        "missing_percentage": 0.0,
        "unique": 4,
        "mode": "Engineering",
        "mode_frequency": 420,
        "top_categories": [
          { "category": "Engineering", "count": 420, "percentage": 42.0 },
          { "category": "Sales", "count": 310, "percentage": 31.0 }
        ]
      }
    },
    "correlation_matrix": {
      "columns": ["age", "income", "credit_score", "tenure"],
      "matrix": {
        "age": { "age": 1.0, "income": 0.88, "credit_score": 0.35, "tenure": 0.62 },
        "income": { "age": 0.88, "income": 1.0, "credit_score": 0.41, "tenure": 0.58 }
      },
      "strong_correlations": [
        {
          "feature_a": "age",
          "feature_b": "income",
          "correlation": 0.88,
          "abs_correlation": 0.88,
          "relationship": "Strong positive correlation"
        }
      ],
      "warnings": [
        "Severe collinearity detected between 'age' and 'income' (r=0.88)."
      ]
    },
    "distributions": {
      "income": {
        "column_name": "income",
        "data_type": "numeric",
        "bins": [
          { "bin_start": 32000.0, "bin_end": 45300.0, "label": "32000.0 - 45300.0", "count": 120, "percentage": 12.0 }
        ],
        "summary": { "count": 1000, "min": 32000.0, "max": 165000.0, "mean": 74500.25, "median": 72000.0 }
      }
    },
    "feature_importance": {
      "target_column": "churn",
      "problem_type": "classification",
      "model_used": "Random Forest Classifier (Baseline)",
      "baseline_score_name": "Baseline Train Accuracy",
      "baseline_score": 0.942,
      "features": [
        { "feature": "income", "importance": 0.412, "percentage": 41.2, "rank": 1 },
        { "feature": "tenure", "importance": 0.285, "percentage": 28.5, "rank": 2 }
      ],
      "candidate_targets": ["churn", "status", "income"]
    },
    "cached": true,
    "created_at": "2026-09-30T16:08:00Z"
  }
  ```

---

## 2. Force Refresh EDA Report
- **Method**: `POST`
- **Path**: `/api/v1/datasets/{dataset_id}/eda/refresh`
- **Request Body**:
  ```json
  {
    "target_column": "churn",
    "use_cleaned": true
  }
  ```
- **Description**: Discards previous cache and recalculates complete EDA analysis.
- **Response**: `200 OK` (same payload format as `GET`, with `"cached": false`).

---

## 3. Sub-Endpoints
- `GET /api/v1/datasets/{dataset_id}/eda/correlations`: Returns correlation matrix, strong pairs, and multicollinearity alerts.
- `GET /api/v1/datasets/{dataset_id}/eda/feature-importance?target_column={target}`: Returns baseline model rankings for a specific target column.
