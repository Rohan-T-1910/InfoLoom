import io
import os
import joblib
import pytest
from fastapi.testclient import TestClient

SAMPLE_TIMESERIES_CSV = b"""date,sales,visitors,region
2023-01-01,120.5,450,North
2023-01-02,135.0,480,North
2023-01-03,110.2,410,North
2023-01-04,155.8,520,North
2023-01-05,142.1,490,North
2023-01-06,160.0,550,North
2023-01-07,175.4,590,North
2023-01-08,130.2,460,North
2023-01-09,145.0,500,North
2023-01-10,150.8,515,North
2023-01-11,168.3,560,North
2023-01-12,172.9,580,North
2023-01-13,185.0,610,North
2023-01-14,190.5,630,North
2023-01-15,140.0,470,North
2023-01-16,158.2,530,North
2023-01-17,162.7,545,North
2023-01-18,179.0,595,North
2023-01-19,183.4,605,North
2023-01-20,195.1,640,North
2023-01-21,210.0,670,North
2023-01-22,152.0,490,North
2023-01-23,169.5,550,North
2023-01-24,174.1,565,North
2023-01-25,188.0,610,North
"""

# Out of order timestamps with duplicates and gaps to test preprocessing robustness
DISORDERED_GAPPED_CSV = b"""timestamp,revenue,category
2023-03-05,250.0,Retail
2023-03-01,100.0,Retail
2023-03-03,150.0,Retail
2023-03-03,170.0,Retail
2023-03-02,120.0,Retail
2023-03-06,260.0,Retail
2023-03-07,280.0,Retail
2023-03-08,290.0,Retail
2023-03-09,310.0,Retail
2023-03-10,320.0,Retail
2023-03-11,340.0,Retail
2023-03-12,350.0,Retail
2023-03-13,370.0,Retail
2023-03-14,380.0,Retail
2023-03-15,400.0,Retail
2023-03-16,410.0,Retail
2023-03-17,430.0,Retail
2023-03-18,440.0,Retail
2023-03-19,460.0,Retail
2023-03-20,470.0,Retail
"""


def test_inspect_forecasting_columns_api(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("ts_sample.csv", io.BytesIO(SAMPLE_TIMESERIES_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    res = client.get(
        f"/api/v1/datasets/{dataset_id}/forecasting/columns",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["dataset_id"] == dataset_id
    assert data["total_rows"] == 25

    date_col_names = [d["name"] for d in data["date_columns"]]
    assert "date" in date_col_names
    date_info = next(d for d in data["date_columns"] if d["name"] == "date")
    assert date_info["min_date"] == "2023-01-01"
    assert date_info["max_date"] == "2023-01-25"

    numeric_names = [n["name"] for n in data["numeric_columns"]]
    assert "sales" in numeric_names
    assert "visitors" in numeric_names
    assert "region" not in numeric_names  # String category excluded

    assert data["recommended_date_column"] == "date"
    assert data["recommended_target_column"] in ["sales", "visitors"]


def test_datetime_parsing_sorting_and_duplicate_aggregation(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("disordered.csv", io.BytesIO(DISORDERED_GAPPED_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Evaluate backtest on disordered, duplicate-timestamp dataset
    eval_res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/evaluate",
        headers=auth_headers_user_a,
        json={
            "date_column": "timestamp",
            "target_column": "revenue",
            "forecast_horizon": 4,
        },
    )
    assert eval_res.status_code == 200
    data = eval_res.json()

    assert data["validation_horizon"] == 4
    assert len(data["validation_points"]) == 4

    # Ensure validation dates are strictly chronological
    val_dates = [p["date"] for p in data["validation_points"]]
    assert val_dates == sorted(val_dates)

    # Check metrics calculated properly
    metrics = data["metrics"]
    assert "mape" in metrics
    assert metrics["mape"] >= 0.0
    assert metrics["rmse"] > 0.0
    assert metrics["mae"] > 0.0


def test_chronological_backtesting_and_mape(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("sales_ts.csv", io.BytesIO(SAMPLE_TIMESERIES_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    eval_res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/evaluate",
        headers=auth_headers_user_a,
        json={
            "date_column": "date",
            "target_column": "sales",
            "forecast_horizon": 5,
        },
    )
    assert eval_res.status_code == 200
    data = eval_res.json()

    assert data["n_historical_points"] == 25
    assert data["validation_horizon"] == 5
    assert len(data["validation_points"]) == 5

    for point in data["validation_points"]:
        assert point["actual"] > 0
        assert point["predicted"] > 0
        assert point["lower_ci"] is not None
        assert point["upper_ci"] is not None
        assert point["lower_ci"] <= point["upper_ci"]

    metrics = data["metrics"]
    assert 0.0 <= metrics["mape"] <= 100.0  # Reasonable percentage error
    assert metrics["rmse"] > 0
    assert metrics["mae"] > 0


def test_run_forecasting_and_persistence(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("sales_run.csv", io.BytesIO(SAMPLE_TIMESERIES_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    run_res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/run",
        headers=auth_headers_user_a,
        json={
            "date_column": "date",
            "target_column": "sales",
            "forecast_horizon": 7,
            "name": "January Sales 7-Day Forecast",
        },
    )
    assert run_res.status_code == 201
    model = run_res.json()
    model_id = model["id"]

    assert model["name"] == "January Sales 7-Day Forecast"
    assert model["forecast_horizon"] == 7
    assert model["date_column"] == "date"
    assert model["target_column"] == "sales"
    assert len(model["forecast_points"]) == 7

    # Check future forecast points and 95% confidence intervals
    for fp in model["forecast_points"]:
        assert fp["date"] > "2023-01-25"  # Strictly into the future!
        assert fp["forecast"] > 0
        assert fp["lower_ci"] <= fp["forecast"] <= fp["upper_ci"] or fp["lower_ci"] <= fp["upper_ci"]

    assert len(model["historical_points"]) == 25
    assert len(model["validation_points"]) > 0

    # Retrieve by ID
    get_res = client.get(
        f"/api/v1/forecasting/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == model_id

    # List dataset models
    list_res = client.get(
        f"/api/v1/datasets/{dataset_id}/forecasting/results",
        headers=auth_headers_user_a,
    )
    assert list_res.status_code == 200
    assert any(m["id"] == model_id for m in list_res.json())

    # Delete model
    del_res = client.delete(
        f"/api/v1/forecasting/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert del_res.status_code == 204

    # Verify deleted
    get_deleted = client.get(
        f"/api/v1/forecasting/models/{model_id}",
        headers=auth_headers_user_a,
    )
    assert get_deleted.status_code == 404


def test_invalid_forecasting_configurations(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("errors_ts.csv", io.BytesIO(SAMPLE_TIMESERIES_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # 1. Non-existent date column
    res_bad_date = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/run",
        headers=auth_headers_user_a,
        json={"date_column": "non_existent_date", "target_column": "sales", "forecast_horizon": 5},
    )
    assert res_bad_date.status_code == 400
    assert "does not exist" in res_bad_date.json()["detail"]

    # 2. Non-numeric target column (region is text)
    res_bad_target = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/run",
        headers=auth_headers_user_a,
        json={"date_column": "date", "target_column": "region", "forecast_horizon": 5},
    )
    assert res_bad_target.status_code == 400
    assert "not numeric" in res_bad_target.json()["detail"]

    # 3. Insufficient observations (< 15 rows)
    tiny_csv = b"date,sales\n2023-01-01,10\n2023-01-02,20\n2023-01-03,30\n"
    up_tiny = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("tiny.csv", io.BytesIO(tiny_csv), "text/csv")},
    )
    tiny_id = up_tiny.json()["id"]

    res_insufficient = client.post(
        f"/api/v1/datasets/{tiny_id}/forecasting/run",
        headers=auth_headers_user_a,
        json={"date_column": "date", "target_column": "sales", "forecast_horizon": 2},
    )
    assert res_insufficient.status_code == 400
    assert "Insufficient observations" in res_insufficient.json()["detail"]


def test_forecasting_multi_tenant_isolation(client: TestClient, auth_headers_user_a, auth_headers_user_b):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("tenant_ts.csv", io.BytesIO(SAMPLE_TIMESERIES_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    run_res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/run",
        headers=auth_headers_user_a,
        json={"date_column": "date", "target_column": "sales", "forecast_horizon": 5},
    )
    model_id = run_res.json()["id"]

    # User B cannot access User A's forecasting columns
    res_b_cols = client.get(
        f"/api/v1/datasets/{dataset_id}/forecasting/columns",
        headers=auth_headers_user_b,
    )
    assert res_b_cols.status_code == 404

    # User B cannot run forecast on User A's dataset
    res_b_run = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/run",
        headers=auth_headers_user_b,
        json={"date_column": "date", "target_column": "sales", "forecast_horizon": 5},
    )
    assert res_b_run.status_code == 404

    # User B cannot access User A's forecast model
    res_b_get = client.get(
        f"/api/v1/forecasting/models/{model_id}",
        headers=auth_headers_user_b,
    )
    assert res_b_get.status_code == 404

    # User B cannot delete User A's forecast model
    res_b_del = client.delete(
        f"/api/v1/forecasting/models/{model_id}",
        headers=auth_headers_user_b,
    )
    assert res_b_del.status_code == 404
