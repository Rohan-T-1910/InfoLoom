import io
import pytest
from fastapi.testclient import TestClient

SAMPLE_DATA_CSV = b"""date,sales,marketing_spend,units,category
2023-01-01,100.0,20.0,10,A
2023-01-02,110.0,22.0,11,A
2023-01-03,115.0,23.5,12,A
2023-01-04,125.0,25.0,13,B
2023-01-05,130.0,26.0,13,B
2023-01-06,140.0,28.0,14,B
2023-01-07,155.0,31.0,15,C
2023-01-08,160.0,32.5,16,C
2023-01-09,175.0,35.0,17,C
2023-01-10,185.0,37.0,18,C
2023-01-11,200.0,40.0,20,A
2023-01-12,210.0,42.0,21,A
2023-01-13,225.0,45.0,22,A
2023-01-14,235.0,47.0,23,B
2023-01-15,250.0,50.0,25,B
"""


def _upload_dataset(client: TestClient, headers: dict, filename: str = "sales.csv", data: bytes = SAMPLE_DATA_CSV) -> int:
    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": (filename, io.BytesIO(data), "text/csv")},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_report_readiness_fresh_dataset(
    client: TestClient,
    auth_headers_user_a,
):
    """
    Validates readiness inspection on a newly uploaded raw dataset.
    Optional phases (EDA, ML, clustering, forecasting, anomalies, insights)
    should be reported as 'unavailable' without failing.
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    resp = client.get(f"/api/v1/datasets/{dataset_id}/reports/readiness", headers=auth_headers_user_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["dataset_id"] == dataset_id
    assert data["total_rows"] == 15
    assert data["ready_for_pdf"] is True
    assert len(data["sections"]) == 8

    # Overview is available by default
    overview = next(s for s in data["sections"] if s["key"] == "overview")
    assert overview["status"] == "available"

    # ML section is unavailable
    ml_section = next(s for s in data["sections"] if s["key"] == "ml_models")
    assert ml_section["status"] == "unavailable"


def test_pdf_report_generation_with_missing_sections(
    client: TestClient,
    auth_headers_user_a,
):
    """
    Generates PDF report for dataset where ML, forecasting, clustering etc have NOT been run.
    ReportLab document compilation must succeed and return a valid PDF with %PDF- header.
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    resp = client.get(f"/api/v1/datasets/{dataset_id}/reports/pdf", headers=auth_headers_user_a)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "Content-Disposition" in resp.headers
    assert "InfoLoom_Report" in resp.headers["Content-Disposition"]

    content = resp.content
    assert len(content) > 1000
    assert content.startswith(b"%PDF-")


def test_pdf_report_generation_with_all_phases_and_charts(
    client: TestClient,
    auth_headers_user_a,
):
    """
    Runs cleaning, EDA, ML, forecasting, anomaly, and insights.
    Then generates the PDF report. Must include all sections and charts.
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    # 1. Clean
    clean_res = client.post(f"/api/v1/datasets/{dataset_id}/clean", headers=auth_headers_user_a)
    assert clean_res.status_code == 200

    # 2. EDA
    eda_res = client.get(f"/api/v1/datasets/{dataset_id}/eda", headers=auth_headers_user_a)
    assert eda_res.status_code == 200

    # 3. Supervised ML
    train_res = client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        json={
            "target_column": "sales",
            "task_type": "regression",
            "algorithms": ["linear_regression"],
        },
        headers=auth_headers_user_a,
    )
    assert train_res.status_code == 202

    # 4. Clustering
    cluster_res = client.post(
        f"/api/v1/datasets/{dataset_id}/clustering/run",
        json={"features": ["sales", "marketing_spend"], "k": 2},
        headers=auth_headers_user_a,
    )
    assert cluster_res.status_code == 201

    # 5. Forecasting
    forecast_res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/run",
        json={
            "date_column": "date",
            "target_column": "sales",
            "forecast_horizon": 5,
        },
        headers=auth_headers_user_a,
    )
    assert forecast_res.status_code == 201

    # 6. Anomaly Detection
    anomaly_res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/run",
        json={"features": ["sales", "marketing_spend"]},
        headers=auth_headers_user_a,
    )
    assert anomaly_res.status_code == 201

    # 7. Insights
    insight_res = client.get(f"/api/v1/datasets/{dataset_id}/insights", headers=auth_headers_user_a)
    assert insight_res.status_code == 200

    # Check readiness shows all available
    readiness = client.get(f"/api/v1/datasets/{dataset_id}/reports/readiness", headers=auth_headers_user_a).json()
    assert readiness["available_sections_count"] >= 7

    # Generate full PDF
    pdf_resp = client.get(f"/api/v1/datasets/{dataset_id}/reports/pdf", headers=auth_headers_user_a)
    assert pdf_resp.status_code == 200
    assert pdf_resp.content.startswith(b"%PDF-")
    # PDF with charts is substantially larger
    assert len(pdf_resp.content) > 10000

    # Audit history should record the generation
    hist_resp = client.get(f"/api/v1/datasets/{dataset_id}/reports/history", headers=auth_headers_user_a)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) >= 1
    assert history[0]["report_type"] == "comprehensive_pdf"


def test_csv_export_ml_predictions_preview_and_download(
    client: TestClient,
    auth_headers_user_a,
):
    """
    Tests CSV prediction preview and export for supervised ML model.
    Checks columns (inputs, actual_sales, predicted_sales, residual_error).
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    # Train model first
    client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        json={
            "target_column": "sales",
            "task_type": "regression",
            "algorithms": ["linear_regression"],
        },
        headers=auth_headers_user_a,
    )

    # Preview CSV
    prev_resp = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/preview?export_type=ml",
        headers=auth_headers_user_a,
    )
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["export_type"] == "ml"
    assert "actual_sales" in prev_data["columns"]
    assert "predicted_sales" in prev_data["columns"]
    assert "residual_error" in prev_data["columns"]
    assert len(prev_data["preview_rows"]) == 5

    # Download full CSV
    csv_resp = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/predictions?export_type=ml",
        headers=auth_headers_user_a,
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Content-Disposition" in csv_resp.headers
    csv_text = csv_resp.content.decode("utf-8")
    lines = csv_text.strip().split("\n")
    header = lines[0].split(",")
    assert "actual_sales" in header
    assert "predicted_sales" in header
    assert len(lines) == 16  # header + 15 data rows


def test_csv_export_forecast_predictions(
    client: TestClient,
    auth_headers_user_a,
):
    """
    Tests CSV prediction preview and export for time-series forecasting.
    Checks horizon_step, timestamp, forecast_value, lower_ci_95, upper_ci_95.
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    fc_res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecasting/run",
        json={"date_column": "date", "target_column": "sales", "forecast_horizon": 4},
        headers=auth_headers_user_a,
    )
    assert fc_res.status_code == 201

    # Preview
    prev = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/preview?export_type=forecast",
        headers=auth_headers_user_a,
    ).json()
    assert prev["export_type"] == "forecast"
    assert "forecast_value" in prev["columns"]
    assert "lower_ci_95" in prev["columns"]
    assert prev["total_rows"] == 4

    # Download
    csv_resp = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/predictions?export_type=forecast",
        headers=auth_headers_user_a,
    )
    assert csv_resp.status_code == 200
    csv_text = csv_resp.content.decode("utf-8")
    assert "horizon_step,timestamp,forecast_value" in csv_text


def test_csv_export_anomaly_predictions(
    client: TestClient,
    auth_headers_user_a,
):
    """
    Tests CSV prediction preview and export for anomaly detection.
    Checks isolation_forest_score, is_anomaly, detection_label.
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    anom_res = client.post(
        f"/api/v1/datasets/{dataset_id}/anomalies/run",
        json={"features": ["sales", "marketing_spend"]},
        headers=auth_headers_user_a,
    )
    assert anom_res.status_code == 201

    # Preview
    prev = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/preview?export_type=anomaly",
        headers=auth_headers_user_a,
    ).json()
    assert prev["export_type"] == "anomaly"
    assert "isolation_forest_score" in prev["columns"]
    assert "is_anomaly" in prev["columns"]
    assert "detection_label" in prev["columns"]

    # Download
    csv_resp = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/predictions?export_type=anomaly",
        headers=auth_headers_user_a,
    )
    assert csv_resp.status_code == 200
    csv_text = csv_resp.content.decode("utf-8")
    assert "detection_label" in csv_text


def test_missing_model_csv_export_error_handling(
    client: TestClient,
    auth_headers_user_a,
):
    """
    When user requests CSV predictions for a model type that has not been trained,
    returns 404 with descriptive error message.
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    # No ML trained
    resp = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/predictions?export_type=ml",
        headers=auth_headers_user_a,
    )
    assert resp.status_code == 404
    assert "No trained machine learning model found" in resp.json()["detail"]

    # Invalid export type returns 400
    bad_type = client.get(
        f"/api/v1/datasets/{dataset_id}/reports/export/predictions?export_type=invalid_type",
        headers=auth_headers_user_a,
    )
    assert bad_type.status_code == 400


def test_multi_tenant_security_isolation(
    client: TestClient,
    auth_headers_user_a,
    auth_headers_user_b,
):
    """
    Ensures that User B cannot access User A's report readiness, PDF report,
    prediction CSV, or history.
    """
    dataset_id = _upload_dataset(client, auth_headers_user_a)

    # User B readiness
    res1 = client.get(f"/api/v1/datasets/{dataset_id}/reports/readiness", headers=auth_headers_user_b)
    assert res1.status_code == 404

    # User B PDF
    res2 = client.get(f"/api/v1/datasets/{dataset_id}/reports/pdf", headers=auth_headers_user_b)
    assert res2.status_code == 404

    # User B CSV preview
    res3 = client.get(f"/api/v1/datasets/{dataset_id}/reports/export/preview?export_type=ml", headers=auth_headers_user_b)
    assert res3.status_code == 404

    # User B CSV export
    res4 = client.get(f"/api/v1/datasets/{dataset_id}/reports/export/predictions?export_type=ml", headers=auth_headers_user_b)
    assert res4.status_code == 404

    # User B history
    res5 = client.get(f"/api/v1/datasets/{dataset_id}/reports/history", headers=auth_headers_user_b)
    assert res5.status_code == 404

    # Invalid dataset ID (99999)
    res6 = client.get("/api/v1/datasets/99999/reports/pdf", headers=auth_headers_user_a)
    assert res6.status_code == 404
