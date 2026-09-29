# InfoLoom Phase 2 API Specification: Validation & Cleaning

Base URL: `/api/v1/datasets`

All endpoints in this specification require Bearer JWT authentication via `Authorization: Bearer <token>` and enforce strict multi-tenant ownership.

---

## 1. Validate Dataset
- **Method**: `POST`
- **Path**: `/api/v1/datasets/{dataset_id}/validate`
- **Description**: Profiles the dataset and returns data health, missingness, duplicates, and outliers.
- **Responses**:
  - `200 OK`:
    ```json
    {
      "dataset_id": 1,
      "total_rows": 1000,
      "total_columns": 5,
      "columns": ["id", "name", "salary", "join_date", "department"],
      "duplicates": {
        "count": 12,
        "percentage": 1.2
      },
      "missing_values": {
        "total_missing_cells": 35,
        "overall_missing_percentage": 0.7,
        "rows_with_missing_count": 28,
        "rows_with_missing_percentage": 2.8,
        "columns": {
          "salary": {
            "missing_count": 15,
            "missing_percentage": 1.5,
            "present_count": 985,
            "severity": "low"
          }
        }
      },
      "columns_profile": {
        "salary": {
          "inferred_type": "float",
          "unique_values": 450,
          "cardinality_ratio": 0.45,
          "count": 985,
          "mean": 65420.5,
          "std": 12350.2,
          "min": 35000.0,
          "q25": 52000.0,
          "median": 64000.0,
          "q75": 78000.0,
          "max": 250000.0,
          "iqr": 26000.0
        }
      },
      "outliers": {
        "salary": {
          "iqr_method": {
            "lower_bound": 13000.0,
            "upper_bound": 117000.0,
            "outlier_count": 8,
            "outlier_percentage": 0.81
          },
          "zscore_method": {
            "threshold": 3.0,
            "lower_bound": 28369.9,
            "upper_bound": 102471.1,
            "outlier_count": 5,
            "outlier_percentage": 0.51
          }
        }
      }
    }
    ```
  - `404 Not Found`: Dataset not found or unauthorized.

---

## 2. Clean Dataset
- **Method**: `POST`
- **Path**: `/api/v1/datasets/{dataset_id}/clean`
- **Request Body** (`application/json`, optional):
  ```json
  {
    "dedup_keep": "first",
    "numeric_impute_strategy": "median",
    "categorical_impute_strategy": "constant",
    "numeric_fill_value": 0.0,
    "categorical_fill_value": "Unknown",
    "drop_column_threshold": 0.85,
    "outlier_strategy": "clip",
    "outlier_method": "iqr"
  }
  ```
- **Responses**:
  - `200 OK`: Returns `CleaningReportResponse` with both validation summary and actions performed.
    ```json
    {
      "id": 1,
      "dataset_id": 1,
      "user_id": 1,
      "status": "completed",
      "validation_summary": { ... },
      "cleaning_summary": {
        "initial_shape": { "rows": 1000, "columns": 5 },
        "final_shape": { "rows": 988, "columns": 5 },
        "rows_removed_total": 12,
        "columns_removed_total": 0,
        "steps_executed": [
          { "step": "deduplication", "duplicates_removed": 12, "rows_before": 1000, "rows_after": 988 },
          { "step": "type_coercion", "columns_coerced_count": 2, "columns": { ... } },
          { "step": "missing_value_imputation", "numeric_strategy": "median", "imputed_columns": { ... } },
          { "step": "outlier_handling", "strategy": "clip", "columns_handled": { ... } }
        ]
      },
      "cleaned_file_path": "uploads/user_1/cleaned_uuid_sales.csv",
      "created_at": "2026-09-29T20:00:00Z"
    }
    ```
  - `404 Not Found`: Dataset not found or unauthorized.

---

## 3. Get Cleaning Report
- **Method**: `GET`
- **Path**: `/api/v1/datasets/{dataset_id}/cleaning-report`
- **Description**: Retrieves the latest persisted cleaning report and transformation ledger.
- **Responses**:
  - `200 OK`: `CleaningReportResponse`
  - `404 Not Found`: Dataset not found, unauthorized, or dataset has not yet been cleaned.

---

## 4. Preview Cleaned Dataset
- **Method**: `GET`
- **Path**: `/api/v1/datasets/{dataset_id}/cleaned-preview`
- **Query Parameters**:
  - `limit` (integer, default 10, max 100): Number of preview sample rows
- **Responses**:
  - `200 OK`:
    ```json
    {
      "id": 1,
      "original_filename": "cleaned_sales.csv",
      "row_count": 988,
      "column_count": 5,
      "columns": ["id", "name", "salary", "join_date", "department"],
      "sample_rows": [
        { "id": 1, "name": "Alice", "salary": 60000.0, "join_date": "2024-01-15", "department": "Engineering" }
      ]
    }
    ```
  - `404 Not Found`: Dataset not found or cleaned artifact does not exist.
