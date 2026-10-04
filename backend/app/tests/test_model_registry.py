import io
import os
from pathlib import Path
from fastapi.testclient import TestClient

SAMPLE_DATA_CSV = b"""date,sales,marketing_spend,visitors,region
2023-01-01,100.0,20.0,10,A
2023-01-02,120.0,25.0,12,A
2023-01-03,110.0,22.0,11,A
2023-01-04,150.0,30.0,15,A
2023-01-05,170.0,35.0,17,A
2023-01-06,160.0,32.0,16,A
2023-01-07,180.0,38.0,18,A
2023-01-08,200.0,42.0,20,B
2023-01-09,190.0,40.0,19,B
2023-01-10,210.0,45.0,21,B
2023-01-11,230.0,48.0,23,B
2023-01-12,220.0,46.0,22,B
2023-01-13,240.0,52.0,24,B
2023-01-14,260.0,55.0,26,B
2023-01-15,250.0,50.0,25,B
"""


def _setup_trained_model(client: TestClient, headers: dict) -> tuple[int, int]:
    """Helper to upload a dataset and train an ML model, returning (dataset_id, model_id)."""
    # 1. Upload dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("sales_data.csv", io.BytesIO(SAMPLE_DATA_CSV), "text/csv")},
        headers=headers,
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    # 2. Train supervised ML model
    train_res = client.post(
        f"/api/v1/datasets/{dataset_id}/train",
        json={
            "target_column": "sales",
            "task_type": "regression",
            "algorithms": ["linear_regression"],
        },
        headers=headers,
    )
    assert train_res.status_code == 202

    # 3. Retrieve trained model
    models_res = client.get(
        f"/api/v1/datasets/{dataset_id}/models",
        headers=headers,
    )
    assert models_res.status_code == 200
    models_list = models_res.json()
    assert len(models_list) >= 1
    return dataset_id, models_list[0]["id"]


def test_register_model_from_trained_ml_model(client: TestClient, auth_headers_user_a):
    """Verifies registering a model version from a Phase 4 trained MLModel."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    reg_res = client.post(
        "/api/v1/models/registry",
        json={
            "name": "sales-forecaster",
            "dataset_id": dataset_id,
            "source_model_id": model_id,
            "description": "Production linear baseline for sales prediction",
            "set_active": True,
        },
        headers=auth_headers_user_a,
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert data["name"] == "sales-forecaster"
    assert data["version"] == 1
    assert data["task_type"] == "regression"
    assert data["target_column"] == "sales"
    assert data["is_active"] is True
    assert data["has_artifact"] is True
    assert data["artifact_size_bytes"] > 0
    assert os.path.exists(data["artifact_path"])
    assert "registry" in data["artifact_path"]


def test_model_versioning_and_automatic_deactivation(client: TestClient, auth_headers_user_a):
    """Verifies registering subsequent versions increments version and deactivates older versions."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    # Version 1
    v1_res = client.post(
        "/api/v1/models/registry",
        json={
            "name": "churn-model",
            "dataset_id": dataset_id,
            "source_model_id": model_id,
            "set_active": True,
        },
        headers=auth_headers_user_a,
    )
    assert v1_res.status_code == 201
    v1_id = v1_res.json()["id"]
    assert v1_res.json()["version"] == 1
    assert v1_res.json()["is_active"] is True

    # Version 2
    v2_res = client.post(
        "/api/v1/models/registry",
        json={
            "name": "churn-model",
            "dataset_id": dataset_id,
            "source_model_id": model_id,
            "set_active": True,
        },
        headers=auth_headers_user_a,
    )
    assert v2_res.status_code == 201
    assert v2_res.json()["version"] == 2
    assert v2_res.json()["is_active"] is True

    # Verify Version 1 was automatically deactivated
    v1_check = client.get(f"/api/v1/models/registry/{v1_id}", headers=auth_headers_user_a)
    assert v1_check.status_code == 200
    assert v1_check.json()["is_active"] is False


def test_list_and_filter_registered_models(client: TestClient, auth_headers_user_a):
    """Verifies listing and filtering models by dataset_id, name, and active status."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    client.post(
        "/api/v1/models/registry",
        json={"name": "filter-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    )

    # List all
    list_res = client.get("/api/v1/models/registry", headers=auth_headers_user_a)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # Filter by name
    name_res = client.get("/api/v1/models/registry?name=filter-test", headers=auth_headers_user_a)
    assert name_res.status_code == 200
    assert all(m["name"] == "filter-test" for m in name_res.json()["items"])

    # Filter by is_active
    active_res = client.get("/api/v1/models/registry?is_active=true", headers=auth_headers_user_a)
    assert active_res.status_code == 200
    assert all(m["is_active"] is True for m in active_res.json()["items"])


def test_activate_model_version(client: TestClient, auth_headers_user_a):
    """Verifies explicit promotion/activation of an older version."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    # Create v1 and v2
    v1 = client.post(
        "/api/v1/models/registry",
        json={"name": "activate-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    ).json()

    v2 = client.post(
        "/api/v1/models/registry",
        json={"name": "activate-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    ).json()

    assert v2["is_active"] is True

    # Re-activate v1
    act_res = client.post(f"/api/v1/models/registry/{v1['id']}/activate", headers=auth_headers_user_a)
    assert act_res.status_code == 200
    assert act_res.json()["is_active"] is True

    # Verify v2 is now inactive
    v2_check = client.get(f"/api/v1/models/registry/{v2['id']}", headers=auth_headers_user_a).json()
    assert v2_check["is_active"] is False


def test_rollback_model_version(client: TestClient, auth_headers_user_a):
    """Verifies rolling back to the previous version and rolling back to a specific target version."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    v1 = client.post(
        "/api/v1/models/registry",
        json={"name": "rollback-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    ).json()

    v2 = client.post(
        "/api/v1/models/registry",
        json={"name": "rollback-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    ).json()

    v3 = client.post(
        "/api/v1/models/registry",
        json={"name": "rollback-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    ).json()

    # Automatic rollback from v3 -> previous version should be v2
    rb_res = client.post(f"/api/v1/models/registry/{v3['id']}/rollback", headers=auth_headers_user_a)
    assert rb_res.status_code == 200
    assert rb_res.json()["version"] == 2
    assert rb_res.json()["is_active"] is True

    # Targeted rollback from v2 -> v1
    target_rb = client.post(
        f"/api/v1/models/registry/{v2['id']}/rollback",
        json={"target_version": 1},
        headers=auth_headers_user_a,
    )
    assert target_rb.status_code == 200
    assert target_rb.json()["version"] == 1
    assert target_rb.json()["is_active"] is True

    # Rollback on v1 when no prior versions exist should fail with 400
    bad_rb = client.post(f"/api/v1/models/registry/{v1['id']}/rollback", headers=auth_headers_user_a)
    assert bad_rb.status_code == 400
    assert "No previous version available" in bad_rb.json()["detail"]


def test_invalid_or_missing_artifact_handling(client: TestClient, auth_headers_user_a):
    """Verifies that activation, rollback, and inference fail gracefully if artifact file is missing on disk."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    reg = client.post(
        "/api/v1/models/registry",
        json={"name": "artifact-integrity-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": False},
        headers=auth_headers_user_a,
    ).json()

    # Simulate corrupted or deleted artifact on disk
    artifact_path = Path(reg["artifact_path"])
    if artifact_path.exists():
        os.remove(artifact_path)

    # Activation must fail with 400
    act_res = client.post(f"/api/v1/models/registry/{reg['id']}/activate", headers=auth_headers_user_a)
    assert act_res.status_code == 400
    assert "Artifact file is missing" in act_res.json()["detail"]

    # Prediction must fail with 400
    pred_res = client.post(
        f"/api/v1/models/registry/{reg['id']}/predict",
        json={"inputs": [{"marketing_spend": 25.0, "visitors": 12}]},
        headers=auth_headers_user_a,
    )
    assert pred_res.status_code == 400
    assert "missing from disk storage" in pred_res.json()["detail"]


def test_predict_with_active_and_registered_model(client: TestClient, auth_headers_user_a):
    """Verifies executing inference against both specific registered models and active models."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    reg = client.post(
        "/api/v1/models/registry",
        json={"name": "prediction-pipeline-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    ).json()

    sample_input = {"marketing_spend": 30.0, "visitors": 15, "region": "A"}

    # 1. Predict via model ID
    id_pred = client.post(
        f"/api/v1/models/registry/{reg['id']}/predict",
        json={"inputs": sample_input},
        headers=auth_headers_user_a,
    )
    assert id_pred.status_code == 200
    assert len(id_pred.json()["predictions"]) == 1
    assert isinstance(id_pred.json()["predictions"][0], (int, float))

    # 2. Predict via active model endpoint
    act_pred = client.post(
        f"/api/v1/models/registry/active/predict?name=prediction-pipeline-test",
        json={"inputs": [sample_input, {"marketing_spend": 50.0, "visitors": 25, "region": "B"}]},
        headers=auth_headers_user_a,
    )
    assert act_pred.status_code == 200
    assert len(act_pred.json()["predictions"]) == 2


def test_delete_model_and_artifact_cleanup(client: TestClient, auth_headers_user_a):
    """Verifies deleting a model version removes the database entry and safely unlinks its artifact."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    reg = client.post(
        "/api/v1/models/registry",
        json={"name": "deletion-cleanup-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": False},
        headers=auth_headers_user_a,
    ).json()

    artifact_path = reg["artifact_path"]
    assert os.path.exists(artifact_path)

    # Delete model
    del_res = client.delete(f"/api/v1/models/registry/{reg['id']}", headers=auth_headers_user_a)
    assert del_res.status_code == 200

    # Verify database record is gone
    get_res = client.get(f"/api/v1/models/registry/{reg['id']}", headers=auth_headers_user_a)
    assert get_res.status_code == 404

    # Verify physical file is safely deleted
    assert not os.path.exists(artifact_path)


def test_ownership_and_cross_tenant_isolation(
    client: TestClient,
    auth_headers_user_a,
    auth_headers_user_b,
):
    """Verifies that User B cannot access, modify, predict, or delete User A's registered models."""
    dataset_id, model_id = _setup_trained_model(client, auth_headers_user_a)

    reg = client.post(
        "/api/v1/models/registry",
        json={"name": "security-isolation-test", "dataset_id": dataset_id, "source_model_id": model_id, "set_active": True},
        headers=auth_headers_user_a,
    ).json()

    # User B cannot read model details
    assert client.get(f"/api/v1/models/registry/{reg['id']}", headers=auth_headers_user_b).status_code == 404

    # User B cannot activate User A's model
    assert client.post(f"/api/v1/models/registry/{reg['id']}/activate", headers=auth_headers_user_b).status_code == 404

    # User B cannot rollback User A's model
    assert client.post(f"/api/v1/models/registry/{reg['id']}/rollback", headers=auth_headers_user_b).status_code == 404

    # User B cannot predict using User A's model
    assert client.post(
        f"/api/v1/models/registry/{reg['id']}/predict",
        json={"inputs": {"marketing_spend": 20}},
        headers=auth_headers_user_b,
    ).status_code == 404

    # User B cannot delete User A's model
    assert client.delete(f"/api/v1/models/registry/{reg['id']}", headers=auth_headers_user_b).status_code == 404

    # User B cannot register a model against User A's dataset
    bad_reg = client.post(
        "/api/v1/models/registry",
        json={"name": "illegal-reg", "dataset_id": dataset_id, "source_model_id": model_id},
        headers=auth_headers_user_b,
    )
    assert bad_reg.status_code == 404
