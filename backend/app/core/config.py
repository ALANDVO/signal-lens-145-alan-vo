import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "signal-lens"
    app_version: str = "1.0.0"
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000

    # Database
    database_url: str = "sqlite+aiosqlite:///./signal_lens.db"

    # Auth / Keycloak
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "signal-lens"
    keycloak_client_id: str = "signal-lens-backend"
    keycloak_client_secret: str = ""
    keycloak_redirect_uri: str = "http://localhost:8000/auth/callback"
    session_secret_key: str = "change-me-in-production"
    session_cookie_name: str = "signal_lens_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"

    # Frontend URL (for CORS)
    frontend_url: str = "http://localhost:5173"

    # LLM (optional)
    llm_api_key: Optional[str] = None
    llm_provider: str = "openai-compatible"
    llm_model: str = "gpt-4o-mini"
    llm_base_url: Optional[str] = None
    llm_timeout: float = 30.0

    # Redis (for session storage in production)
    redis_url: Optional[str] = None


settings = Settings()


def get_settings() -> Settings:
    return settings