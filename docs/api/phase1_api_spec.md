# InfoLoom Phase 1 API Specification

Base URL: `/api/v1`

---

## 1. Authentication Endpoints

### 1.1 Register User
- **Method**: `POST`
- **Path**: `/api/v1/auth/register`
- **Access**: Public
- **Request Body** (`application/json`):
  ```json
  {
    "name": "Alex Mercer",
    "email": "alex@example.com",
    "password": "securepassword123"
  }
  ```
- **Responses**:
  - `201 Created`:
    ```json
    {
      "id": 1,
      "name": "Alex Mercer",
      "email": "alex@example.com",
      "role": "User",
      "created_at": "2026-09-29T16:00:00Z"
    }
    ```
  - `400 Bad Request`: Email already registered.
  - `422 Unprocessable Entity`: Validation failure (e.g. short password, invalid email format).

---

### 1.2 Login (JSON)
- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Access**: Public
- **Request Body** (`application/json`):
  ```json
  {
    "email": "alex@example.com",
    "password": "securepassword123"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer"
    }
    ```
  - `401 Unauthorized`: Incorrect email or password.

---

### 1.3 Login (OAuth2 Form / Swagger UI)
- **Method**: `POST`
- **Path**: `/api/v1/auth/token`
- **Access**: Public
- **Content-Type**: `application/x-www-form-urlencoded`
- **Form Data**:
  - `username`: `alex@example.com`
  - `password`: `securepassword123`
- **Responses**:
  - `200 OK`: Returns JWT token for OpenAPI documentation authorization.

---

### 1.4 Get Profile
- **Method**: `GET`
- **Path**: `/api/v1/auth/me`
- **Access**: Protected (`Authorization: Bearer <token>`)
- **Responses**:
  - `200 OK`:
    ```json
    {
      "id": 1,
      "name": "Alex Mercer",
      "email": "alex@example.com",
      "role": "User",
      "created_at": "2026-09-29T16:00:00Z"
    }
    ```
  - `401 Unauthorized`: Missing or invalid Bearer token.

---

## 2. Dataset Management Endpoints

### 2.1 Upload CSV Dataset
- **Method**: `POST`
- **Path**: `/api/v1/datasets/upload`
- **Access**: Protected (`Authorization: Bearer <token>`)
- **Content-Type**: `multipart/form-data`
- **Form Field**:
  - `file`: CSV file (up to 100MB by default)
- **Responses**:
  - `201 Created`:
    ```json
    {
      "id": 10,
      "user_id": 1,
      "filename": "f3b4..._sales_q3.csv",
      "original_filename": "sales_q3.csv",
      "file_size_bytes": 1048576,
      "row_count": 1250,
      "column_count": 8,
      "status": "ready",
      "created_at": "2026-09-29T16:10:00Z",
      "updated_at": "2026-09-29T16:10:00Z",
      "columns_metadata": {
        "columns": ["date", "store_id", "revenue", "units_sold"],
        "schema": {
          "date": { "type": "string" },
          "store_id": { "type": "integer" },
          "revenue": { "type": "float" },
          "units_sold": { "type": "integer" }
        }
      }
    }
    ```
  - `400 Bad Request`: Non-CSV file or empty file.
  - `413 Content Too Large`: Exceeds maximum configured upload size.

---

### 2.2 List Datasets
- **Method**: `GET`
- **Path**: `/api/v1/datasets`
- **Access**: Protected (`Authorization: Bearer <token>`)
- **Query Parameters**:
  - `skip` (integer, default 0): Offset for pagination
  - `limit` (integer, default 50, max 100): Page size
- **Responses**:
  - `200 OK`:
    ```json
    {
      "items": [
        {
          "id": 10,
          "user_id": 1,
          "filename": "...",
          "original_filename": "sales_q3.csv",
          "file_size_bytes": 1048576,
          "row_count": 1250,
          "column_count": 8,
          "status": "ready",
          "created_at": "2026-09-29T16:10:00Z",
          "updated_at": "2026-09-29T16:10:00Z"
        }
      ],
      "total": 1
    }
    ```

---

### 2.3 Get Dataset Detail
- **Method**: `GET`
- **Path**: `/api/v1/datasets/{dataset_id}`
- **Access**: Protected (`Authorization: Bearer <token>`)
- **Responses**:
  - `200 OK`: DatasetDetailResponse including columns metadata.
  - `404 Not Found`: Dataset does not exist or belongs to another user.

---

### 2.4 Preview Dataset Rows
- **Method**: `GET`
- **Path**: `/api/v1/datasets/{dataset_id}/preview`
- **Access**: Protected (`Authorization: Bearer <token>`)
- **Query Parameters**:
  - `limit` (integer, default 10, max 100): Number of preview rows
- **Responses**:
  - `200 OK`:
    ```json
    {
      "id": 10,
      "original_filename": "sales_q3.csv",
      "row_count": 1250,
      "column_count": 4,
      "columns": ["date", "store_id", "revenue", "units_sold"],
      "sample_rows": [
        { "date": "2026-01-01", "store_id": "101", "revenue": "450.00", "units_sold": "15" },
        { "date": "2026-01-02", "store_id": "102", "revenue": "620.50", "units_sold": "22" }
      ]
    }
    ```
  - `404 Not Found`: Dataset not found or unauthorized.

---

### 2.5 Delete Dataset
- **Method**: `DELETE`
- **Path**: `/api/v1/datasets/{dataset_id}`
- **Access**: Protected (`Authorization: Bearer <token>`)
- **Responses**:
  - `204 No Content`: Dataset and its storage file successfully deleted.
  - `404 Not Found`: Dataset does not exist or belongs to another user.
