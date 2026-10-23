# Signal Lens - Backend Tests
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from app.core.database import Base, get_db
from app.core.config import Settings
from app.models import User, UserRole, Signal, Analysis

# Test database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def test_user(db_session: AsyncSession):
    user = User(
        keycloak_sub="test-sub-123",
        email="test@example.com",
        name="Test User",
        role=UserRole.VIEWER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession):
    user = User(
        keycloak_sub="admin-sub-456",
        email="admin@example.com",
        name="Admin User",
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestHealth:
    def test_health_endpoint(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestAuth:
    def test_login_redirects(self, client):
        response = client.get("/api/auth/login", follow_redirects=False)
        assert response.status_code == 307
        assert "location" in response.headers

    def test_me_unauthenticated(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401


class TestSignals:
    def test_upload_signal_unauthenticated(self, client):
        response = client.post(
            "/api/signals",
            data={"name": "test", "sample_rate": 1000, "duration_seconds": 10},
            files={"file": ("test.csv", b"1,2,3\n", "text/csv")},
        )
        assert response.status_code == 401

    def test_list_signals_unauthenticated(self, client):
        response = client.get("/api/signals")
        assert response.status_code == 401


class TestSignalAnalysis:
    @pytest.mark.asyncio
    async def test_statistical_analysis(self, db_session, test_user):
        from app.services.signal_analysis import statistical_analysis, load_signal_data
        import numpy as np
        import tempfile
        import os

        data = np.random.randn(1000).astype(np.float32)
        with tempfile.NamedTemporaryFile(suffix=".npy", delete=False) as f:
            np.save(f, data)
            temp_path = f.name

        try:
            results, anomaly_count = statistical_analysis(data, {"window_size": 50, "threshold": 3.0})
            assert "features" in results
            assert "anomaly_indices" in results
            assert "data_length" in results
            assert results["data_length"] == 1000
            assert isinstance(anomaly_count, int)
        finally:
            os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_isolation_forest_analysis(self, db_session, test_user):
        from app.services.signal_analysis import isolation_forest_analysis
        import numpy as np

        np.random.seed(42)
        data = np.random.randn(2000).astype(np.float32)
        data[100:150] += 10

        results, anomaly_count = isolation_forest_analysis(data, {"window_size": 50, "contamination": 0.1})
        assert "anomaly_indices" in results
        assert "anomaly_scores" in results
        assert isinstance(anomaly_count, int)
        assert anomaly_count >= 0

    @pytest.mark.asyncio
    async def test_comprehensive_analysis(self, db_session, test_user):
        from app.services.signal_analysis import comprehensive_analysis
        import numpy as np

        np.random.seed(42)
        data = np.random.randn(2000).astype(np.float32)
        data[100:150] += 10

        results, anomaly_count = comprehensive_analysis(data, {"sample_rate": 1000, "window_size": 50})
        assert "statistical_features" in results
        assert "spectral_features" in results
        assert "isolation_forest" in results
        assert "combined_anomaly_indices" in results
        assert isinstance(anomaly_count, int)


class TestModels:
    @pytest.mark.asyncio
    async def test_create_user(self, db_session):
        from app.services import create_user
        user = await create_user(db_session, "sub-1", "user1@test.com", "User One")
        assert user.id is not None
        assert user.email == "user1@test.com"
        assert user.role == UserRole.VIEWER

    @pytest.mark.asyncio
    async def test_create_signal(self, db_session, test_user):
        from app.services import create_signal
        signal = await create_signal(
            db_session,
            owner_id=test_user.id,
            name="Test Signal",
            sample_rate=1000,
            duration_seconds=10,
            data_path="/tmp/test.csv",
        )
        assert signal.id is not None
        assert signal.name == "Test Signal"
        assert signal.owner_id == test_user.id

    @pytest.mark.asyncio
    async def test_create_analysis(self, db_session, test_user):
        from app.services import create_signal, create_analysis
        signal = await create_signal(
            db_session,
            owner_id=test_user.id,
            name="Test Signal",
            sample_rate=1000,
            duration_seconds=10,
            data_path="/tmp/test.csv",
        )
        analysis = await create_analysis(
            db_session,
            signal_id=signal.id,
            owner_id=test_user.id,
            method="statistical",
            results={"mean": 0.0, "std": 1.0},
            anomaly_count=5,
        )
        assert analysis.id is not None
        assert analysis.method == "statistical"
        assert analysis.anomaly_count == 5