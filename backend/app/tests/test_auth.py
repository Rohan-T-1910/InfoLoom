from fastapi.testclient import TestClient

def test_register_user_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Jane Doe",
            "email": "janedoe@example.com",
            "password": "strongpassword123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Jane Doe"
    assert data["email"] == "janedoe@example.com"
    assert data["role"] == "User"
    assert "id" in data
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "password" not in data
    assert "password_hash" not in data

def test_register_duplicate_email(client: TestClient, user_a):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "User A Duplicate",
            "email": user_a.email,
            "password": "newpassword123",
        },
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()

def test_register_invalid_password(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Short Pass",
            "email": "short@example.com",
            "password": "123",  # Under 6 chars
        },
    )
    assert response.status_code == 422

def test_login_json_success(client: TestClient, user_a):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": user_a.email,
            "password": "password123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_form_success(client: TestClient, user_a):
    response = client.post(
        "/api/v1/auth/token",
        data={
            "username": user_a.email,
            "password": "password123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

def test_login_form_at_login_endpoint(client: TestClient, user_a):
    response = client.post(
        "/api/v1/auth/login",
        data={
            "email": user_a.email,
            "password": "password123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client: TestClient, user_a):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": user_a.email,
            "password": "incorrectpassword",
        },
    )
    assert response.status_code == 401
    assert "incorrect" in response.json()["detail"].lower()

def test_login_nonexistent_user(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "notfound@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 401

def test_get_current_user_me(client: TestClient, user_a, auth_headers_user_a):
    response = client.get("/api/v1/auth/me", headers=auth_headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user_a.id
    assert data["email"] == user_a.email

def test_get_current_user_unauthorized(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

def test_get_current_user_invalid_token(client: TestClient):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalidtoken123"})
    assert response.status_code == 401
