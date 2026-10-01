import os
import shutil
import tempfile
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.user import User

# In-memory SQLite for high-speed, isolated test execution
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    temp_dir = tempfile.mkdtemp()
    settings.UPLOAD_DIR = temp_dir
    settings.MODELS_DIR = os.path.join(temp_dir, "models")
    os.makedirs(settings.MODELS_DIR, exist_ok=True)
    import app.database.session as session_module
    orig_session_local = session_module.SessionLocal
    session_module.SessionLocal = TestingSessionLocal
    yield
    session_module.SessionLocal = orig_session_local
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture(scope="function")
def db_session() -> Generator:
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def user_a(db_session) -> User:
    user = User(
        name="User A",
        email="usera@example.com",
        password_hash=hash_password("password123"),
        role="User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture(scope="function")
def user_b(db_session) -> User:
    user = User(
        name="User B",
        email="userb@example.com",
        password_hash=hash_password("password456"),
        role="User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture(scope="function")
def auth_headers_user_a(user_a) -> dict[str, str]:
    token = create_access_token(subject=user_a.id, extra_claims={"email": user_a.email, "role": user_a.role})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="function")
def auth_headers_user_b(user_b) -> dict[str, str]:
    token = create_access_token(subject=user_b.id, extra_claims={"email": user_b.email, "role": user_b.role})
    return {"Authorization": f"Bearer {token}"}
