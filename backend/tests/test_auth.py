# Signal Lens - Backend Tests
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

import numpy as np
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from app.core.database import Base, get_db
from app.core.config import Settings
from app.models import User, UserRole, Signal, Analysis
from app.services.signal_analysis import load_signal_data

# Test database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(test_engine, autocommit=False, autoflush=False)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestingSessionLocal() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def client():
    return TestClient(app)


# Fixtures for test users
@pytest.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def test_user(db_session):
    from app.models import User, UserRole
    user = User(
        keycloak_sub="sub-1",
        email="test@example.com",
        name="Test User",
        role=UserRole.VIEWER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestHealth:
    def test_health_endpoint(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert "version" in response.json()


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
        from app.services.signal_analysis import statistical_analysis
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
    async def test_load_signal_data_json_validation(self):
        """Test that load_signal_data validates JSON content."""
        import tempfile, os

        # Test empty JSON array
        with tempfile.NamedTemporaryFile(suffix=".json", mode="w", delete=False) as f:
            f.write("[]")
            tmp = f.name
        try:
            with pytest.raises(ValueError, match="non-empty array"):
                load_signal_data(tmp)
        finally:
            os.unlink(tmp)

        # Test non-numeric values
        with tempfile.NamedTemporaryFile(suffix=".json", mode="w", delete=False) as f:
            f.write("[1, 2, \"a\"]")
            tmp = f.name
        try:
            with pytest.raises(ValueError, match="numeric values"):
                load_signal_data(tmp)
        finally:
            os.unlink(tmp)

        # Test invalid JSON format
        with tempfile.NamedTemporaryFile(suffix=".json", mode="w", delete=False) as f:
            f.write("not valid json")
            tmp = f.name
        try:
            with pytest.raises(ValueError, match="Unsupported file format"):
                load_signal_data(tmp)
        finally:
            os.unlink(tmp)

        # Test valid JSON array (should succeed)
        with tempfile.NamedTemporaryFile(suffix=".json", mode="w", delete=False) as f:
            f.write("[1.0, 2.0, 3.0]")
            tmp = f.name
        try:
            result = load_signal_data(tmp)
            assert len(result) == 3
            assert result.dtype == np.float32
        finally:
            os.unlink(tmp)


class TestModels:
    @pytest.mark.asyncio
    async def test_create_user(self, db_session):
        from app.services import create_user
        user = await create_user(
            db_session,
            keycloak_sub="sub-1",
            email="user1@test.com",
            name="User One",
        )
        assert user.id is not None
        assert user.email == "user1@test.com"
        assert user.name == "User One"
        assert user.role.name == "VIEWER"

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
        from app.services.signal_analysis import statistical_analysis
        import numpy as np
        import tempfile
        import os

        # Create a signal first
        signal = await create_signal(
            db_session,
            owner_id=test_user.id,
            name="Test Signal",
            sample_rate=1000,
            duration_seconds=10,
            data_path="/tmp/test.csv",
        )

        # Create some data and analyze
        data = np.random.randn(100).astype(np.float32)
        with tempfile.NamedTemporaryFile(suffix=".npy", delete=False) as f:
            np.save(f, data)
            temp_path = f.name

        try:
            results, anomaly_count = statistical_analysis(data, {"window_size": 10, "threshold": 3.0})
            analysis = await create_analysis(
                db_session,
                signal_id=signal.id,
                owner_id=test_user.id,
                method="statistical",
                results=results,
                parameters={"window_size": 10, "threshold": 3.0},
                anomaly_count=anomaly_count,
            )
            assert analysis.id is not None
            assert analysis.method == "statistical"
        finally:
            os.unlink(temp_path)


class TestImportant:
    pass
