import io
import os
import joblib
import pytest
from fastapi.testclient import TestClient

SAMPLE_CUSTOMER_CSV = b"""customer_id,age,annual_income,spending_score,loyalty_years,city
1,19,15000,39,1,New York
2,21,15000,81,2,Chicago
3,20,16000,6,1,New York
4,23,16000,77,3,San Francisco
5,31,17000,40,4,New York
6,22,17000,76,2,Chicago
7,35,18000,6,5,Chicago
8,23,18000,94,1,San Francisco
9,64,19000,3,10,New York
10,30,19000,72,3,Chicago
11,67,19000,14,12,San Francisco
12,35,19000,99,4,New York
13,58,20000,15,8,Chicago
14,24,20000,77,2,San Francisco
15,37,20000,13,6,New York
16,22,20000,79,1,Chicago
17,35,21000,35,4,San Francisco
18,20,21000,66,1,New York
19,52,23000,29,7,Chicago
20,35,23000,98,3,San Francisco
"""


def test_get_clustering_features_api(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("customers.csv", io.BytesIO(SAMPLE_CUSTOMER_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    res = client.get(
        f"/api/v1/datasets/{dataset_id}/clustering/features",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["dataset_id"] == dataset_id
    assert data["total_rows"] == 20

    numeric_names = [f["name"] for f in data["numeric_features"]]
    assert "age" in numeric_names
    assert "annual_income" in numeric_names
    assert "spending_score" in numeric_names
    assert "city" not in numeric_names  # String category excluded

    # Verify summary stats
    income_stat = next(f for f in data["numeric_features"] if f["name"] == "annual_income")
    assert income_stat["min"] == 15000.0
    assert income_stat["max"] == 23000.0
    assert income_stat["non_null_count"] == 20


def test_evaluate_clustering_elbow_and_silhouette(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("customers_eval.csv", io.BytesIO(SAMPLE_CUSTOMER_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    eval_res = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/evaluate",
        headers=auth_headers_user_a,
        json={
            "features": ["annual_income", "spending_score"],
            "k_min": 2,
            "k_max": 5,
        },
    )
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["n_samples"] == 20
    assert len(eval_data["k_metrics"]) == 4  # k = 2, 3, 4, 5

    k_values = [m["k"] for m in eval_data["k_metrics"]]
    assert k_values == [2, 3, 4, 5]

    for metric in eval_data["k_metrics"]:
        assert "inertia" in metric
        assert metric["inertia"] > 0
        assert "silhouette_score" in metric
        assert metric["silhouette_score"] is not None
        assert -1.0 <= metric["silhouette_score"] <= 1.0

    assert 2 <= eval_data["suggested_k"] <= 5
    assert len(eval_data["suggestion_reason"]) > 0


def test_run_clustering_success_and_profiling(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("customers_run.csv", io.BytesIO(SAMPLE_CUSTOMER_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    run_res = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        headers=auth_headers_user_a,
        json={
            "features": ["annual_income", "spending_score"],
            "k": 3,
            "name": "Customer Segmentation (Income vs Spend)",
        },
    )
    assert run_res.status_code == 201
    model = run_res.json()
    model_id = model["id"]

    assert model["name"] == "Customer Segmentation (Income vs Spend)"
    assert model["k"] == 3
    assert model["feature_names"] == ["annual_income", "spending_score"]
    assert model["n_samples"] == 20
    assert model["inertia"] > 0
    assert model["silhouette_score"] is not None

    # Check cluster profiles
    profiles = model["cluster_profiles"]
    assert len(profiles) == 3

    total_size = sum(p["size"] for p in profiles)
    assert total_size == 20
    total_pct = sum(p["percentage"] for p in profiles)
    assert 99.0 <= total_pct <= 101.0

    for profile in profiles:
        assert "cluster_id" in profile
        assert "name" in profile
        assert len(profile["stats"]) == 2  # 2 features
        for s in profile["stats"]:
            assert s["min"] <= s["median"] <= s["max"]

    # Check 2D sample assignments
    samples = model["sample_assignments"]
    assert len(samples) == 20
    for s in samples:
        assert 0 <= s["cluster"] < 3
        assert s["x"] is not None
        assert s["y"] is not None

    # Verify model retrieval endpoint
    get_res = client.get(
        f"/api/v1/clustering/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == model_id

    # Verify dataset models list
    list_res = client.get(
        f"/api/v1/datasets/{dataset_id}/clustering/results",
        headers=auth_headers_user_a,
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1
    assert any(m["id"] == model_id for m in list_res.json())

    # Delete model
    del_res = client.delete(
        f"/api/v1/clustering/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert del_res.status_code == 204

    # Verify deleted
    get_deleted = client.get(
        f"/api/v1/clustering/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert get_deleted.status_code == 404


def test_clustering_validation_and_error_cases(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("customers_errors.csv", io.BytesIO(SAMPLE_CUSTOMER_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # 1. Non-existent feature
    res_bad_feat = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        headers=auth_headers_user_a,
        json={"features": ["annual_income", "non_existent"], "k": 3},
    )
    assert res_bad_feat.status_code == 400
    assert "does not exist" in res_bad_feat.json()["detail"]

    # 2. Non-numeric feature (city)
    res_non_numeric = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        headers=auth_headers_user_a,
        json={"features": ["city"], "k": 3},
    )
    assert res_non_numeric.status_code == 400
    assert "not numeric" in res_non_numeric.json()["detail"]

    # 3. Invalid K value (< 2)
    res_k_small = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        headers=auth_headers_user_a,
        json={"features": ["annual_income"], "k": 1},
    )
    assert res_k_small.status_code in [400, 422]

    # 4. Invalid K value (>= n_samples)
    res_k_huge = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        headers=auth_headers_user_a,
        json={"features": ["annual_income"], "k": 20},
    )
    assert res_k_huge.status_code == 400
    assert "strictly less than sample size" in res_k_huge.json()["detail"]


def test_clustering_multi_tenant_isolation(client: TestClient, auth_headers_user_a, auth_headers_user_b):
    # User A creates a dataset and trains clustering
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("tenant_a.csv", io.BytesIO(SAMPLE_CUSTOMER_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    run_res = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        headers=auth_headers_user_a,
        json={"features": ["annual_income", "spending_score"], "k": 2},
    )
    model_id = run_res.json()["id"]

    # User B cannot access User A's dataset features
    res_b_feat = client.get(
        f"/api/v1/datasets/{dataset_id}/clustering/features",
        headers=auth_headers_user_b,
    )
    assert res_b_feat.status_code == 404

    # User B cannot run clustering on User A's dataset
    res_b_run = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        headers=auth_headers_user_b,
        json={"features": ["annual_income", "spending_score"], "k": 2},
    )
    assert res_b_run.status_code == 404

    # User B cannot get User A's clustering model
    res_b_get = client.get(
        f"/api/v1/clustering/models/{model_id}",
        headers=auth_headers_user_b,
    )
    assert res_b_get.status_code == 404

    # User B cannot delete User A's clustering model
    res_b_del = client.delete(
        f"/api/v1/clustering/models/{model_id}",
        headers=auth_headers_user_b,
    )
    assert res_b_del.status_code == 404
