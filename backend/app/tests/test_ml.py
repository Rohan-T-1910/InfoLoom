import io
import time
from fastapi.testclient import TestClient

SAMPLE_ML_CSV = b"""id,age,income,credit_score,department,churn
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
13,27,53000,660,Sales,1
14,55,150000,810,Executive,0
15,39,88000,720,Marketing,0
16,42,95000,740,Engineering,0
"""

def test_inspect_target_api(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("ml_sample.csv", io.BytesIO(SAMPLE_ML_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    # Inspect classification target
    inspect_res = client.get(
        f"/api/v1/datasets/{dataset_id}/train/inspect-target?target_column=churn",
        headers=auth_headers_user_a,
    )
    assert inspect_res.status_code == 200
    data = inspect_res.json()
    assert data["target_column"] == "churn"
    assert data["inferred_task_type"] == "classification"
    assert data["unique_count"] == 2
    assert "income" in data["candidate_features"]

    # Inspect regression target
    inspect_reg = client.get(
        f"/api/v1/datasets/{dataset_id}/train/inspect-target?target_column=income",
        headers=auth_headers_user_a,
    )
    assert inspect_reg.status_code == 200
    reg_data = inspect_reg.json()
    assert reg_data["target_column"] == "income"
    assert reg_data["inferred_task_type"] == "regression"

    # Non-existent target validation
    bad_target = client.get(
        f"/api/v1/datasets/{dataset_id}/train/inspect-target?target_column=non_existent",
        headers=auth_headers_user_a,
    )
    assert bad_target.status_code == 400


def test_train_and_evaluate_regression_suite(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("reg_sample.csv", io.BytesIO(SAMPLE_ML_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Enqueue training job for regression (predicting income)
    train_res = client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        headers=auth_headers_user_a,
        json={
            "task_type": "regression",
            "target_column": "income",
            "feature_columns": ["age", "credit_score", "department"],
            "test_size": 0.25,
            "cv_folds": 3,
        },
    )
    assert train_res.status_code == 202
    job = train_res.json()
    job_id = job["id"]

    # Fetch job details and leaderboard
    job_res = client.get(f"/api/v1/ml/jobs/{job_id}", headers=auth_headers_user_a)
    assert job_res.status_code == 200
    completed_job = job_res.json()
    assert completed_job["status"] == "completed"
    assert completed_job["best_model_id"] is not None

    leaderboard = completed_job["leaderboard"]
    assert len(leaderboard) >= 2  # Linear Regression, Random Forest, XGBoost
    # Best model should be ranked first
    assert leaderboard[0]["is_best"] is True

    # Verify metrics for regression
    for model_item in leaderboard:
        metrics = model_item["metrics"]
        assert "rmse" in metrics
        assert "mae" in metrics
        assert "r2" in metrics
        assert "cv_mean" in metrics
        assert metrics["rmse"] >= 0

    # Test predict on best model
    best_model_id = completed_job["best_model_id"]
    predict_res = client.post(
        f"/api/v1/ml/models/{best_model_id}/predict",
        headers=auth_headers_user_a,
        json={
            "inputs": [
                {"age": 30, "credit_score": 710, "department": "Engineering"},
                {"age": 52, "credit_score": 800, "department": "Executive"},
            ]
        },
    )
    assert predict_res.status_code == 200
    pred_data = predict_res.json()
    assert len(pred_data["predictions"]) == 2
    assert isinstance(pred_data["predictions"][0], (int, float))
    assert pred_data["predictions"][1] > pred_data["predictions"][0]  # Older executive predicts higher income


def test_train_and_evaluate_classification_suite(client: TestClient, auth_headers_user_a):
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("clf_sample.csv", io.BytesIO(SAMPLE_ML_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Enqueue training job for classification (predicting churn)
    train_res = client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        headers=auth_headers_user_a,
        json={
            "task_type": "classification",
            "target_column": "churn",
            "test_size": 0.25,
            "cv_folds": 3,
        },
    )
    assert train_res.status_code == 202
    job_id = train_res.json()["id"]

    job_res = client.get(f"/api/v1/ml/jobs/{job_id}", headers=auth_headers_user_a)
    assert job_res.status_code == 200
    completed_job = job_res.json()
    assert completed_job["status"] == "completed"

    leaderboard = completed_job["leaderboard"]
    assert len(leaderboard) >= 2

    # Verify classification metrics
    for model_item in leaderboard:
        metrics = model_item["metrics"]
        assert "accuracy" in metrics
        assert "precision" in metrics
        assert "recall" in metrics
        assert "f1" in metrics
        assert "cv_mean" in metrics

    # Predict with classification model and verify probabilities
    best_model_id = completed_job["best_model_id"]
    predict_res = client.post(
        f"/api/v1/ml/models/{best_model_id}/predict",
        headers=auth_headers_user_a,
        json={
            "inputs": {
                "age": 22,
                "income": 40000,
                "credit_score": 600,
                "department": "Sales",
            }
        },
    )
    assert predict_res.status_code == 200
    pred_data = predict_res.json()
    assert len(pred_data["predictions"]) == 1
    assert pred_data["probabilities"] is not None
    assert len(pred_data["probabilities"]) == 1


def test_ml_validation_and_multi_tenant_isolation(client: TestClient, auth_headers_user_a, auth_headers_user_b):
    # User A uploads dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("isolation_sample.csv", io.BytesIO(SAMPLE_ML_CSV), "text/csv")},
    )
    dataset_id = upload_res.json()["id"]

    # Incompatible task type validation (e.g. regression on string department)
    bad_task_res = client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        headers=auth_headers_user_a,
        json={"task_type": "regression", "target_column": "department"},
    )
    assert bad_task_res.status_code == 400
    assert "not numeric" in bad_task_res.json()["detail"]

    # User B cannot trigger training on User A's dataset
    unauth_train = client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        headers=auth_headers_user_b,
        json={"task_type": "classification", "target_column": "churn"},
    )
    assert unauth_train.status_code == 404

    # User A trains a valid model
    train_res = client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        headers=auth_headers_user_a,
        json={"task_type": "classification", "target_column": "churn", "cv_folds": 2},
    )
    job_id = train_res.json()["id"]
    job_res = client.get(f"/api/v1/ml/jobs/{job_id}", headers=auth_headers_user_a)
    model_id = job_res.json()["best_model_id"]

    # User B cannot access User A's job
    job_user_b = client.get(f"/api/v1/ml/jobs/{job_id}", headers=auth_headers_user_b)
    assert job_user_b.status_code == 404

    # User B cannot access User A's model
    model_user_b = client.get(f"/api/v1/ml/models/{model_id}", headers=auth_headers_user_b)
    assert model_user_b.status_code == 404

    # User B cannot predict on User A's model
    predict_user_b = client.post(
        f"/api/v1/ml/models/{model_id}/predict",
        headers=auth_headers_user_b,
        json={"inputs": {"age": 25}},
    )
    assert predict_user_b.status_code == 404
