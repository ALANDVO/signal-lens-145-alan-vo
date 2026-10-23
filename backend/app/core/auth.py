import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlencode

from authlib.integrations.starlette_client import OAuth
from fastapi import Request, HTTPException, Response, Depends
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import get_db
from app.models import User

settings = get_settings()

oauth = OAuth()

oauth.register(
    name="keycloak",
    server_metadata_url=f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/.well-known/openid-configuration",
    client_id=settings.keycloak_client_id,
    client_secret=settings.keycloak_client_secret,
    client_kwargs={
        "scope": "openid email profile",
        "code_challenge_method": "S256",
    },
)


def create_state() -> str:
    return secrets.token_urlsafe(32)


def create_nonce() -> str:
    return secrets.token_urlsafe(32)


def create_pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = secrets.token_urlsafe(64)
    return verifier, challenge


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    session_data = request.session.get("user")
    if not session_data:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = session_data.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


def require_role(allowed_roles: list[str]):
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker


def create_session_response(response: Response, user: User, tokens: Dict[str, Any]) -> None:
    request = getattr(response, "_request", None)
    if request:
        request.session["user"] = {
            "sub": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": tokens.get("expires_at"),
        }


def clear_session(request: Request) -> None:
    request.session.clear()


def build_auth_url(request: Request) -> str:
    state = create_state()
    nonce = create_nonce()
    verifier, challenge = create_pkce_pair()

    request.session["oauth_state"] = state
    request.session["oauth_nonce"] = nonce
    request.session["pkce_verifier"] = verifier

    params = {
        "response_type": "code",
        "client_id": settings.keycloak_client_id,
        "redirect_uri": settings.keycloak_redirect_uri,
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }

    auth_endpoint = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/auth"
    return f"{auth_endpoint}?{urlencode(params)}"


async def exchange_code_for_tokens(
    request: Request,
    code: str,
) -> Dict[str, Any]:
    stored_state = request.session.pop("oauth_state", None)
    stored_nonce = request.session.pop("oauth_nonce", None)
    pkce_verifier = request.session.pop("pkce_verifier", None)

    if not stored_state or not stored_nonce or not pkce_verifier:
        raise HTTPException(status_code=400, detail="Missing OAuth session data")

    token_endpoint = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/token"

    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.keycloak_redirect_uri,
        "client_id": settings.keycloak_client_id,
        "client_secret": settings.keycloak_client_secret,
        "code_verifier": pkce_verifier,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(token_endpoint, data=data, timeout=10.0)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Token exchange failed")
        tokens = resp.json()

    return tokens


async def validate_id_token(id_token: str, nonce: str) -> Dict[str, Any]:
    try:
        claims = jwt.decode(
            id_token,
            key="",
            options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_iss": False,
            },
        )
    except JWTError as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {e}")

    if claims.get("nonce") != nonce:
        raise HTTPException(status_code=400, detail="Nonce mismatch")

    return claims


async def get_or_create_user(db: AsyncSession, claims: Dict[str, Any]) -> User:
    sub = claims.get("sub")
    email = claims.get("email")
    name = claims.get("name") or claims.get("preferred_username") or email

    result = await db.execute(select(User).where(User.keycloak_sub == sub))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            keycloak_sub=sub,
            email=email,
            name=name,
            role="viewer",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


import httpx