import io
import os
from fastapi.testclient import TestClient
from app.core.config import settings

SAMPLE_CSV_CONTENT = b"""id,name,age,salary
1,Alice,30,75000.50
2,Bob,25,50000.00
3,Charlie,35,92000.00
"""

def test_upload_csv_success(client: TestClient, auth_headers_user_a):
    file_data = io.BytesIO(SAMPLE_CSV_CONTENT)
    response = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("test_data.csv", file_data, "text/csv")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "test_data.csv"
    assert data["row_count"] == 3
    assert data["column_count"] == 4
    assert data["status"] == "ready"
    assert "columns_metadata" in data
    assert data["columns_metadata"]["columns"] == ["id", "name", "age", "salary"]

def test_upload_non_csv_rejected(client: TestClient, auth_headers_user_a):
    file_data = io.BytesIO(b"malicious script content")
    response = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("script.py", file_data, "text/plain")},
    )
    assert response.status_code == 400
    assert "only csv files" in response.json()["detail"].lower()

def test_upload_empty_csv_rejected(client: TestClient, auth_headers_user_a):
    file_data = io.BytesIO(b"")
    response = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("empty.csv", file_data, "text/csv")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()

def test_upload_size_limit_exceeded(client: TestClient, auth_headers_user_a, monkeypatch):
    # Set size limit temporarily to 50 bytes
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 50)
    file_data = io.BytesIO(SAMPLE_CSV_CONTENT)  # 65+ bytes
    response = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("large.csv", file_data, "text/csv")},
    )
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"].lower()

def test_list_datasets(client: TestClient, auth_headers_user_a):
    # Upload one dataset first
    client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("list_test.csv", io.BytesIO(SAMPLE_CSV_CONTENT), "text/csv")},
    )
    response = client.get("/api/v1/datasets", headers=auth_headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1

def test_get_dataset_detail_and_preview(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("preview_test.csv", io.BytesIO(SAMPLE_CSV_CONTENT), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Get details
    detail_res = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth_headers_user_a)
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == dataset_id

    # Preview rows
    preview_res = client.get(f"/api/v1/datasets/{dataset_id}/preview?limit=2", headers=auth_headers_user_a)
    assert preview_res.status_code == 200
    p_data = preview_res.json()
    assert p_data["columns"] == ["id", "name", "age", "salary"]
    assert len(p_data["sample_rows"]) == 2
    assert p_data["sample_rows"][0]["name"] == "Alice"

def test_delete_dataset(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("to_delete.csv", io.BytesIO(SAMPLE_CSV_CONTENT), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    delete_res = client.delete(f"/api/v1/datasets/{dataset_id}", headers=auth_headers_user_a)
    assert delete_res.status_code == 204

    # Verify not found after delete
    get_res = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth_headers_user_a)
    assert get_res.status_code == 404

def test_strict_multi_tenancy_isolation(
    client: TestClient, auth_headers_user_a, auth_headers_user_b
):
    # User A uploads a dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("private_a.csv", io.BytesIO(SAMPLE_CSV_CONTENT), "text/csv")},
    )
    dataset_id_a = upload_res.json()["id"]

    # User B lists datasets -> should be empty
    list_res_b = client.get("/api/v1/datasets", headers=auth_headers_user_b)
    assert list_res_b.status_code == 200
    assert list_res_b.json()["total"] == 0
    assert list_res_b.json()["items"] == []

    # User B tries to view User A's dataset -> 404 Not Found
    get_res_b = client.get(f"/api/v1/datasets/{dataset_id_a}", headers=auth_headers_user_b)
    assert get_res_b.status_code == 404

    # User B tries to preview User A's dataset -> 404 Not Found
    preview_res_b = client.get(f"/api/v1/datasets/{dataset_id_a}/preview", headers=auth_headers_user_b)
    assert preview_res_b.status_code == 404

    # User B tries to delete User A's dataset -> 404 Not Found
    del_res_b = client.delete(f"/api/v1/datasets/{dataset_id_a}", headers=auth_headers_user_b)
    assert del_res_b.status_code == 404

    # Ensure User A can still access their dataset
    get_res_a = client.get(f"/api/v1/datasets/{dataset_id_a}", headers=auth_headers_user_a)
    assert get_res_a.status_code == 200
