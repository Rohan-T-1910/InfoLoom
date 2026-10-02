import io
import os
import joblib
import pytest
from fastapi.testclient import TestClient

SAMPLE_METRICS_CSV = b"""server_id,cpu_usage,memory_usage,request_latency_ms,error_rate,status_code
1,25.0,40.0,45.2,0.01,200
2,28.5,42.1,48.0,0.01,200
3,31.2,45.0,52.1,0.02,200
4,27.0,41.5,46.8,0.01,200
5,29.1,43.2,49.5,0.01,200
6,26.4,39.8,44.1,0.01,200
7,30.0,44.0,51.0,0.02,200
8,28.0,42.0,47.5,0.01,200
9,25.8,40.5,45.9,0.01,200
10,32.0,46.2,53.4,0.02,200
11,27.5,41.8,48.2,0.01,200
12,29.8,43.9,50.1,0.01,200
13,26.9,40.1,46.0,0.01,200
14,31.5,45.8,52.8,0.02,200
15,28.2,42.5,48.9,0.01,200
16,27.1,41.0,47.2,0.01,200
17,30.5,44.5,51.5,0.02,200
18,29.0,43.0,49.0,0.01,200
19,98.5,95.0,920.5,0.85,500
20,95.0,91.2,850.0,0.78,500
"""

SAMPLE_TINY_CSV = b"""id,val
1,10.0
2,12.0
3,11.5
"""


def test_get_anomaly_features_api(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("metrics.csv", io.BytesIO(SAMPLE_METRICS_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    res = client.get(
        f"/api/v1/datasets/{dataset_id}/anomalies/features",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["dataset_id"] == dataset_id
    assert data["total_rows"] == 20

    feat_names = [f["name"] for f in data["numeric_features"]]
    assert "cpu_usage" in feat_names
    assert "memory_usage" in feat_names
    assert "request_latency_ms" in feat_names
    assert "error_rate" in feat_names

    cpu_stat = next(f for f in data["numeric_features"] if f["name"] == "cpu_usage")
    assert cpu_stat["min"] == 25.0
    assert cpu_stat["max"] == 98.5
    assert cpu_stat["non_null_count"] == 20


def test_evaluate_anomaly_config_api(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("metrics.csv", io.BytesIO(SAMPLE_METRICS_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    eval_payload = {
        "features": ["cpu_usage", "memory_usage", "request_latency_ms"],
        "contamination": 0.10,
        "use_cleaned": False,
    }

    res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/evaluate",
        headers=auth_headers_user_a,
        json=eval_payload,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["n_samples"] == 20
    assert data["estimated_anomalies"] >= 1
    assert data["estimated_percentage"] > 0
    assert len(data["score_distribution"]) > 0


def test_run_anomaly_detection_and_persistence(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("metrics.csv", io.BytesIO(SAMPLE_METRICS_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    run_payload = {
        "features": ["cpu_usage", "memory_usage", "request_latency_ms", "error_rate"],
        "contamination": 0.10,
        "name": "Server Outlier Detection",
        "n_estimators": 100,
        "use_cleaned": False,
    }

    res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/run",
        headers=auth_headers_user_a,
        json=run_payload,
    )
    assert res.status_code == 201
    model = res.json()
    model_id = model["id"]
    assert model["name"] == "Server Outlier Detection"
    assert model["n_samples"] == 20
    assert model["n_anomalies"] == 2  # rows 19 and 20 are massive spikes
    assert model["anomaly_percentage"] == 10.0
    assert model["status"] == "completed"

    # Verify flagged anomalous rows and deviation explanations
    assert len(model["anomalous_rows"]) == 2
    top_anom = model["anomalous_rows"][0]
    assert top_anom["severity"] in ["high", "medium"]
    assert len(top_anom["top_deviations"]) > 0
    # Top deviation z-score should be positive and high
    assert abs(top_anom["top_deviations"][0]["z_score"]) > 2.0

    # Verify scatter projection points
    assert len(model["scatter_points"]) > 0
    anom_scatter = [p for p in model["scatter_points"] if p["is_anomaly"]]
    assert len(anom_scatter) == 2

    # Verify listing
    list_res = client.get(
        f"/api/v1/datasets/{dataset_id}/anomalies/results",
        headers=auth_headers_user_a,
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Verify retrieval
    get_res = client.get(
        f"/api/v1/anomalies/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == model_id

    # Verify deletion
    del_res = client.delete(
        f"/api/v1/anomalies/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert del_res.status_code == 204

    # Verify 404 after deletion
    get_again = client.get(
        f"/api/v1/anomalies/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert get_again.status_code == 404


def test_anomaly_validation_and_error_cases(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("metrics.csv", io.BytesIO(SAMPLE_METRICS_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # 1. Non-existent feature
    res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/run",
        headers=auth_headers_user_a,
        json={"features": ["ghost_col"], "contamination": 0.05},
    )
    assert res.status_code == 422
    assert "ghost_col" in res.json()["detail"].lower()

    # 2. Invalid contamination > 0.5
    res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/run",
        headers=auth_headers_user_a,
        json={"features": ["cpu_usage"], "contamination": 0.99},
    )
    assert res.status_code == 422

    # 3. Insufficient rows (< 10)
    upload_tiny = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("tiny.csv", io.BytesIO(SAMPLE_TINY_CSV), "text/csv")},
    )
    tiny_id = upload_tiny.json()["id"]
    res = client.post(
        f"/api/v1/datasets/{tiny_id}/anomalies/run",
        headers=auth_headers_user_a,
        json={"features": ["val"], "contamination": 0.05},
    )
    assert res.status_code == 422
    assert "at least 10" in res.json()["detail"].lower()


def test_anomaly_multi_tenant_isolation(client: TestClient, auth_headers_user_a, auth_headers_user_b):
    # User A uploads dataset and runs anomaly detection
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("metrics.csv", io.BytesIO(SAMPLE_METRICS_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    run_res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/run",
        headers=auth_headers_user_a,
        json={"features": ["cpu_usage", "memory_usage"], "contamination": 0.05},
    )
    model_id = run_res.json()["id"]

    # User B tries to view features of User A's dataset
    res = client.get(
        f"/api/v1/datasets/{dataset_id}/anomalies/features",
        headers=auth_headers_user_b,
    )
    assert res.status_code == 404

    # User B tries to evaluate on User A's dataset
    res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/evaluate",
        headers=auth_headers_user_b,
        json={"features": ["cpu_usage"]},
    )
    assert res.status_code == 404

    # User B tries to get User A's anomaly model
    res = client.get(
        f"/api/v1/anomalies/models/{model_id}",
        headers=auth_headers_user_b,
    )
    assert res.status_code == 404

    # User B tries to delete User A's anomaly model
    res = client.delete(
        f"/api/v1/anomalies/models/{model_id}",
        headers=auth_headers_user_b,
    )
    assert res.status_code == 404
