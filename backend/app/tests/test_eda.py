import io
from fastapi.testclient import TestClient

SAMPLE_EDA_CSV = b"""id,age,income,credit_score,department,churn
1,25,50000,650,Sales,0
2,30,60000,700,Engineering,0
3,45,120000,780,Engineering,0
4,22,40000,600,Sales,1
5,38,85000,710,Marketing,0
6,50,140000,790,Executive,0
7,29,58000,670,Sales,1
8,41,92000,730,Marketing,0
9,35,75000,690,Engineering,0
10,23,42000,610,Sales,1
11,48,130000,770,Executive,0
12,32,68000,680,Engineering,0
"""

def test_full_eda_report_api(client: TestClient, auth_headers_user_a):
    # Upload sample dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("eda_sample.csv", io.BytesIO(SAMPLE_EDA_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    # 1. Fetch full EDA report
    eda_res = client.get(
        f"/api/v1/datasets/{dataset_id}/eda",
        headers=auth_headers_user_a,
    )
    assert eda_res.status_code == 200
    data = eda_res.json()

    # Verify KPIs
    kpis = data["kpis"]
    assert kpis["row_count"] == 12
    assert kpis["column_count"] == 6
    assert kpis["total_cells"] == 72
    assert kpis["missing_cells"] == 0
    assert kpis["duplicate_rows"] == 0
    assert kpis["numeric_columns_count"] >= 4
    assert kpis["categorical_columns_count"] >= 1
    assert "memory_human" in kpis

    # Verify Summary Statistics
    stats = data["summary_statistics"]
    assert "income" in stats
    assert stats["income"]["data_type"] == "numeric"
    assert stats["income"]["mean"] > 0
    assert stats["income"]["median"] > 0
    assert stats["income"]["min"] == 40000
    assert stats["income"]["max"] == 140000
    assert "skewness" in stats["income"]
    assert "kurtosis" in stats["income"]

    assert "department" in stats
    assert stats["department"]["data_type"] == "categorical"
    assert stats["department"]["unique"] == 4
    assert len(stats["department"]["top_categories"]) > 0

    # Verify Correlation Matrix
    corr = data["correlation_matrix"]
    assert "columns" in corr
    assert "income" in corr["matrix"]
    assert corr["matrix"]["income"]["income"] == 1.0
    # Income and age should have high correlation
    assert len(corr["strong_correlations"]) > 0
    income_age_pair = next((p for p in corr["strong_correlations"] if (p["feature_a"] == "age" and p["feature_b"] == "income") or (p["feature_a"] == "income" and p["feature_b"] == "age")), None)
    assert income_age_pair is not None
    assert income_age_pair["correlation"] > 0.8

    # Verify Distributions
    distributions = data["distributions"]
    assert "age" in distributions
    assert distributions["age"]["data_type"] == "numeric"
    assert len(distributions["age"]["bins"]) > 0

    assert "department" in distributions
    assert distributions["department"]["data_type"] == "categorical"
    assert len(distributions["department"]["bins"]) > 0

    # Verify Feature Importance
    fi = data["feature_importance"]
    assert fi is not None
    assert "churn" in fi["candidate_targets"] or fi["target_column"] == "churn"
    assert len(fi["features"]) > 0
    assert fi["features"][0]["importance"] >= 0

    # First call is not cached
    assert data["cached"] is False


def test_eda_caching_and_force_refresh(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("eda_cache_test.csv", io.BytesIO(SAMPLE_EDA_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # First fetch: computes and caches
    res1 = client.get(
        f"/api/v1/datasets/{dataset_id}/eda?target_column=churn",
        headers=auth_headers_user_a,
    )
    assert res1.status_code == 200
    assert res1.json()["cached"] is False

    # Second fetch: returns cached
    res2 = client.get(
        f"/api/v1/datasets/{dataset_id}/eda?target_column=churn",
        headers=auth_headers_user_a,
    )
    assert res2.status_code == 200
    assert res2.json()["cached"] is True

    # Force refresh via query param: re-computes
    res3 = client.get(
        f"/api/v1/datasets/{dataset_id}/eda?target_column=churn&force_refresh=true",
        headers=auth_headers_user_a,
    )
    assert res3.status_code == 200
    assert res3.json()["cached"] is False

    # Refresh via POST endpoint
    res4 = client.post(
        f"/api/v1/datasets/{dataset_id}/eda/refresh",
        headers=auth_headers_user_a,
        json={"target_column": "churn"},
    )
    assert res4.status_code == 200
    assert res4.json()["cached"] is False


def test_eda_cache_invalidation_on_cleaning(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("eda_invalidation_test.csv", io.BytesIO(SAMPLE_EDA_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Generate EDA
    res1 = client.get(f"/api/v1/datasets/{dataset_id}/eda", headers=auth_headers_user_a)
    assert res1.json()["cached"] is False

    # Cached on next call
    res2 = client.get(f"/api/v1/datasets/{dataset_id}/eda", headers=auth_headers_user_a)
    assert res2.json()["cached"] is True

    # Clean the dataset (which should invalidate cache)
    clean_res = client.post(
        f"/api/v1/datasets/{dataset_id}/clean",
        headers=auth_headers_user_a,
        json={"numeric_impute_strategy": "median"},
    )
    assert clean_res.status_code == 200

    # EDA after clean: should re-compute because old cache is invalidated
    res3 = client.get(f"/api/v1/datasets/{dataset_id}/eda", headers=auth_headers_user_a)
    assert res3.status_code == 200
    assert res3.json()["cached"] is False


def test_eda_correlations_and_feature_importance_subendpoints(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("subendpoints_test.csv", io.BytesIO(SAMPLE_EDA_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    corr_res = client.get(
        f"/api/v1/datasets/{dataset_id}/eda/correlations",
        headers=auth_headers_user_a,
    )
    assert corr_res.status_code == 200
    corr = corr_res.json()
    assert "columns" in corr
    assert "matrix" in corr

    fi_res = client.get(
        f"/api/v1/datasets/{dataset_id}/eda/feature-importance?target_column=churn",
        headers=auth_headers_user_a,
    )
    assert fi_res.status_code == 200
    fi = fi_res.json()
    assert fi["target_column"] == "churn"
    assert fi["problem_type"] == "classification"
    assert len(fi["features"]) > 0


def test_eda_multi_tenant_isolation(client: TestClient, auth_headers_user_a, auth_headers_user_b):
    # User A uploads dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("usera_eda.csv", io.BytesIO(SAMPLE_EDA_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # User B attempts to access User A's EDA
    res_b = client.get(
        f"/api/v1/datasets/{dataset_id}/eda",
        headers=auth_headers_user_b,
    )
    assert res_b.status_code == 404


RETAIL_SAMPLE_CSV = b"""Transaction ID,Customer ID,Age,Quantity,Price per Unit,Total Amount
1,1001,25,2,50,100
2,1002,30,1,120,120
3,1003,45,3,40,120
4,1004,22,4,25,100
5,1005,38,2,80,160
6,1006,50,1,200,200
7,1007,29,5,30,150
8,1008,41,2,90,180
9,1009,35,3,60,180
10,1010,23,1,50,50
11,1011,48,2,110,220
12,1012,32,4,45,180
"""


def test_eda_excludes_identifiers_from_correlations_and_collinearity(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("retail_sample.csv", io.BytesIO(RETAIL_SAMPLE_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    eda_res = client.get(
        f"/api/v1/datasets/{dataset_id}/eda",
        headers=auth_headers_user_a,
    )
    assert eda_res.status_code == 200
    data = eda_res.json()

    corr = data["correlation_matrix"]
    # 1. Identifier columns must not be in correlation columns
    assert "Transaction ID" not in corr["columns"]
    assert "Customer ID" not in corr["columns"]

    # 2. Legitimate numeric business fields must be present
    assert "Quantity" in corr["columns"]
    assert "Price per Unit" in corr["columns"]
    assert "Total Amount" in corr["columns"]
    assert "Age" in corr["columns"]

    # 3. No relationships involving identifiers
    for pair in corr.get("strong_correlations", []):
        assert pair["feature_a"] not in ["Transaction ID", "Customer ID"]
        assert pair["feature_b"] not in ["Transaction ID", "Customer ID"]

    # 4. Warnings must NOT mention collinearity or identifiers
    for w in corr.get("warnings", []):
        assert "collinearity" not in w.lower()
        assert "Transaction ID" not in w
        assert "Customer ID" not in w

    # 5. Candidate targets and feature importance must NOT include identifiers
    fi = data.get("feature_importance")
    if fi:
        for tgt in fi.get("candidate_targets", []):
            assert tgt not in ["Transaction ID", "Customer ID"]
        assert fi["target_column"] not in ["Transaction ID", "Customer ID"]
        for feat in fi.get("features", []):
            assert feat["feature"] not in ["Transaction ID", "Customer ID"]
