from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import json
import os
import shutil
from pathlib import Path

from app.core.config import get_settings
from app.core.database import get_db
from app.core.auth import (
    get_current_user,
    get_optional_user,
    require_role,
    build_auth_url,
    exchange_code_for_tokens,
    validate_id_token,
    get_or_create_user,
    create_session_response,
    clear_session,
)
from app.models import User, Signal, Analysis, UserRole
from app.services import (
    create_signal,
    get_signal,
    list_signals,
    count_signals,
    delete_signal,
    create_analysis,
    get_analysis,
    list_analyses,
    create_audit_log,
)

router = APIRouter()
settings = get_settings()

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version}


@router.get("/auth/login")
async def login(request: Request):
    auth_url = build_auth_url(request)
    return RedirectResponse(url=auth_url)


@router.get("/auth/callback")
async def auth_callback(request: Request, code: str, state: str, db: AsyncSession = Depends(get_db)):
    stored_state = request.session.get("oauth_state")
    if not stored_state or stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid state")

    tokens = await exchange_code_for_tokens(request, code)
    id_token = tokens.get("id_token")
    nonce = request.session.get("oauth_nonce")

    if not id_token or not nonce:
        raise HTTPException(status_code=400, detail="Missing ID token or nonce")

    claims = await validate_id_token(id_token, nonce)
    user = await get_or_create_user(db, claims)

    response = RedirectResponse(url=settings.frontend_url)
    create_session_response(response, user, tokens)

    await create_audit_log(db, user.id, "login", "user", user.id, "User logged in via Keycloak")

    return response


@router.post("/auth/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    user = request.session.get("user")
    if user:
        await create_audit_log(db, user.get("sub"), "logout", "user", user.get("sub"), "User logged out")
    clear_session(request)
    return {"message": "Logged out"}


@router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
    }


@router.post("/signals", status_code=status.HTTP_201_CREATED)
async def upload_signal(
    request: Request,
    name: str = Form(...),
    sample_rate: int = Form(...),
    duration_seconds: int = Form(...),
    channels: int = Form(1),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.endswith((".csv", ".json", ".npy")):
        raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV, JSON, or NPY.")

    file_path = UPLOAD_DIR / f"{user.id}_{name}_{file.filename}"
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    metadata = {"original_filename": file.filename, "content_type": file.content_type}

    signal = await create_signal(
        db=db,
        owner_id=user.id,
        name=name,
        sample_rate=sample_rate,
        duration_seconds=duration_seconds,
        channels=channels,
        data_path=str(file_path),
        description=description,
        metadata=metadata,
    )

    await create_audit_log(db, user.id, "create", "signal", signal.id, f"Uploaded signal: {name}")

    return {
        "id": signal.id,
        "name": signal.name,
        "sample_rate": signal.sample_rate,
        "duration_seconds": signal.duration_seconds,
        "channels": signal.channels,
        "description": signal.description,
        "created_at": signal.created_at.isoformat(),
    }


@router.get("/signals")
async def get_signals(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == UserRole.ADMIN:
        signals = await list_signals(db, skip=skip, limit=limit)
        total = await count_signals(db)
    else:
        signals = await list_signals(db, owner_id=user.id, skip=skip, limit=limit)
        total = await count_signals(db, owner_id=user.id)

    return {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "sample_rate": s.sample_rate,
                "duration_seconds": s.duration_seconds,
                "channels": s.channels,
                "description": s.description,
                "created_at": s.created_at.isoformat(),
            }
            for s in signals
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/signals/{signal_id}")
async def get_signal_detail(
    signal_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signal = await get_signal(db, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if user.role != UserRole.ADMIN and signal.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    analyses = await list_analyses(db, signal_id=signal_id)

    return {
        "id": signal.id,
        "name": signal.name,
        "sample_rate": signal.sample_rate,
        "duration_seconds": signal.duration_seconds,
        "channels": signal.channels,
        "description": signal.description,
        "data_path": signal.data_path,
        "metadata": json.loads(signal.metadata) if signal.metadata else None,
        "created_at": signal.created_at.isoformat(),
        "analyses": [
            {
                "id": a.id,
                "method": a.method,
                "anomaly_count": a.anomaly_count,
                "status": a.status,
                "created_at": a.created_at.isoformat(),
            }
            for a in analyses
        ],
    }


@router.delete("/signals/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signal_endpoint(
    signal_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signal = await get_signal(db, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if user.role != UserRole.ADMIN and signal.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if os.path.exists(signal.data_path):
        os.remove(signal.data_path)

    await delete_signal(db, signal_id)
    await create_audit_log(db, user.id, "delete", "signal", signal_id, f"Deleted signal: {signal.name}")


@router.post("/signals/{signal_id}/analyze", status_code=status.HTTP_201_CREATED)
async def analyze_signal(
    signal_id: int,
    method: str = Form(...),
    parameters: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signal = await get_signal(db, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if user.role != UserRole.ADMIN and signal.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    param_dict = json.loads(parameters) if parameters else {}

    from app.services.signal_analysis import analyze_signal_data
    results, anomaly_count = await analyze_signal_data(signal.data_path, method, param_dict)

    analysis = await create_analysis(
        db=db,
        signal_id=signal_id,
        owner_id=user.id,
        method=method,
        results=results,
        parameters=param_dict,
        anomaly_count=anomaly_count,
    )

    await create_audit_log(db, user.id, "analyze", "signal", signal_id, f"Analyzed with {method}")

    return {
        "id": analysis.id,
        "method": analysis.method,
        "results": results,
        "anomaly_count": analysis.anomaly_count,
        "status": analysis.status,
        "created_at": analysis.created_at.isoformat(),
    }


@router.get("/signals/{signal_id}/analyses")
async def get_signal_analyses(
    signal_id: int,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signal = await get_signal(db, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if user.role != UserRole.ADMIN and signal.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    analyses = await list_analyses(db, signal_id=signal_id, skip=skip, limit=limit)

    return {
        "items": [
            {
                "id": a.id,
                "method": a.method,
                "results": json.loads(a.results),
                "parameters": json.loads(a.parameters) if a.parameters else None,
                "anomaly_count": a.anomaly_count,
                "status": a.status,
                "created_at": a.created_at.isoformat(),
            }
            for a in analyses
        ],
        "skip": skip,
        "limit": limit,
    }


@router.get("/analyses/{analysis_id}")
async def get_analysis_detail(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await get_analysis(db, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if user.role != UserRole.ADMIN and analysis.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "id": analysis.id,
        "signal_id": analysis.signal_id,
        "method": analysis.method,
        "results": json.loads(analysis.results),
        "parameters": json.loads(analysis.parameters) if analysis.parameters else None,
        "anomaly_count": analysis.anomaly_count,
        "status": analysis.status,
        "created_at": analysis.created_at.isoformat(),
    }


@router.get("/export/analyses/{analysis_id}")
async def export_analysis(
    analysis_id: int,
    format: str = "json",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await get_analysis(db, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if user.role != UserRole.ADMIN and analysis.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    data = {
        "id": analysis.id,
        "signal_id": analysis.signal_id,
        "method": analysis.method,
        "results": json.loads(analysis.results),
        "parameters": json.loads(analysis.parameters) if analysis.parameters else None,
        "anomaly_count": analysis.anomaly_count,
        "status": analysis.status,
        "created_at": analysis.created_at.isoformat(),
    }

    if format == "csv":
        import io
        import csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["key", "value"])
        for k, v in data.items():
            writer.writerow([k, json.dumps(v) if isinstance(v, (dict, list)) else v])
        return JSONResponse(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=analysis_{analysis_id}.csv"},
        )

    return JSONResponse(
        content=data,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=analysis_{analysis_id}.json"},
    )