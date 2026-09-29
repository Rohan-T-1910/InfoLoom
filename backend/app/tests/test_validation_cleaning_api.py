import io
from fastapi.testclient import TestClient

DIRTY_CSV_CONTENT = b"""id,name,salary,department
1, Alice , $60000 , Engineering
2, Bob , $55000 , Marketing
2, Bob , $55000 , Marketing
3, Charlie ,  , Engineering
4, David , $2500000 , Executive
"""

def test_validate_dataset_api(client: TestClient, auth_headers_user_a):
    # Upload dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("dirty_data.csv", io.BytesIO(DIRTY_CSV_CONTENT), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Validate dataset
    val_res = client.post(
        f"/api/v1/datasets/{dataset_id}/validate",
        headers=auth_headers_user_a,
    )
    assert val_res.status_code == 200
    data = val_res.json()
    assert data["dataset_id"] == dataset_id
    assert data["total_rows"] == 5
    assert data["duplicates"]["count"] == 1
    assert data["missing_values"]["columns"]["salary"]["missing_count"] == 1
    assert "salary" in data["outliers"]

def test_clean_dataset_api(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("to_clean.csv", io.BytesIO(DIRTY_CSV_CONTENT), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Clean with config
    clean_res = client.post(
        f"/api/v1/datasets/{dataset_id}/clean",
        headers=auth_headers_user_a,
        json={
            "dedup_keep": "first",
            "numeric_impute_strategy": "median",
            "outlier_strategy": "clip",
            "outlier_method": "iqr",
        },
    )
    assert clean_res.status_code == 200
    report = clean_res.json()
    assert report["dataset_id"] == dataset_id
    assert report["status"] == "completed"
    assert "validation_summary" in report
    assert "cleaning_summary" in report
    assert report["cleaning_summary"]["rows_removed_total"] == 1  # Duplicate removed

    # Verify persisted report can be fetched
    get_report_res = client.get(
        f"/api/v1/datasets/{dataset_id}/cleaning-report",
        headers=auth_headers_user_a,
    )
    assert get_report_res.status_code == 200
    assert get_report_res.json()["id"] == report["id"]

    # Verify cleaned preview
    preview_res = client.get(
        f"/api/v1/datasets/{dataset_id}/cleaned-preview",
        headers=auth_headers_user_a,
    )
    assert preview_res.status_code == 200
    p_data = preview_res.json()
    assert p_data["row_count"] == 4  # 5 minus 1 duplicate
    # Alice's name stripped of whitespace
    assert p_data["sample_rows"][0]["name"] == "Alice"

def test_cleaning_multi_tenancy_isolation(
    client: TestClient, auth_headers_user_a, auth_headers_user_b
):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("user_a_dirty.csv", io.BytesIO(DIRTY_CSV_CONTENT), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # User B cannot validate User A's dataset
    val_res_b = client.post(
        f"/api/v1/datasets/{dataset_id}/validate",
        headers=auth_headers_user_b,
    )
    assert val_res_b.status_code == 404

    # User B cannot clean User A's dataset
    clean_res_b = client.post(
        f"/api/v1/datasets/{dataset_id}/clean",
        headers=auth_headers_user_b,
    )
    assert clean_res_b.status_code == 404

    # User A cleans dataset
    client.post(
        f"/api/v1/datasets/{dataset_id}/clean",
        headers=auth_headers_user_a,
    )

    # User B cannot get cleaning report of User A's dataset
    report_res_b = client.get(
        f"/api/v1/datasets/{dataset_id}/cleaning-report",
        headers=auth_headers_user_b,
    )
    assert report_res_b.status_code == 404

    # User B cannot preview cleaned version of User A's dataset
    preview_res_b = client.get(
        f"/api/v1/datasets/{dataset_id}/cleaned-preview",
        headers=auth_headers_user_b,
    )
    assert preview_res_b.status_code == 404
