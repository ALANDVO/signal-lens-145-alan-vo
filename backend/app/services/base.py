from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.models import User, UserRole, Signal, Analysis, AuditLog


async def create_user(
    db: AsyncSession,
    keycloak_sub: str,
    email: str,
    name: str,
    role: UserRole = UserRole.VIEWER,
) -> User:
    user = User(keycloak_sub=keycloak_sub, email=email, name=name, role=role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_sub(db: AsyncSession, sub: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.keycloak_sub == sub))
    return result.scalar_one_or_none()


async def list_users(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
    result = await db.execute(select(User).offset(skip).limit(limit).order_by(desc(User.created_at)))
    return list(result.scalars().all())


async def update_user_role(db: AsyncSession, user_id: int, role: UserRole) -> Optional[User]:
    user = await get_user_by_id(db, user_id)
    if user:
        user.role = role
        user.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)
    return user


async def create_signal(
    db: AsyncSession,
    owner_id: int,
    name: str,
    sample_rate: int,
    duration_seconds: int,
    data_path: str,
    channels: int = 1,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Signal:
    import json
    signal = Signal(
        owner_id=owner_id,
        name=name,
        sample_rate=sample_rate,
        duration_seconds=duration_seconds,
        data_path=data_path,
        channels=channels,
        description=description,
        signal_metadata=json.dumps(metadata) if metadata else None,
    )
    db.add(signal)
    await db.commit()
    await db.refresh(signal)
    return signal


async def get_signal(db: AsyncSession, signal_id: int) -> Optional[Signal]:
    result = await db.execute(
        select(Signal).options(selectinload(Signal.analyses)).where(Signal.id == signal_id)
    )
    return result.scalar_one_or_none()


async def list_signals(
    db: AsyncSession,
    owner_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Signal]:
    query = select(Signal).order_by(desc(Signal.created_at))
    if owner_id:
        query = query.where(Signal.owner_id == owner_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_signals(db: AsyncSession, owner_id: Optional[int] = None) -> int:
    query = select(func.count(Signal.id))
    if owner_id:
        query = query.where(Signal.owner_id == owner_id)
    result = await db.execute(query)
    return result.scalar_one()


async def delete_signal(db: AsyncSession, signal_id: int) -> bool:
    signal = await get_signal(db, signal_id)
    if not signal:
        return False
    await db.delete(signal)
    await db.commit()
    return True


async def create_analysis(
    db: AsyncSession,
    signal_id: int,
    owner_id: int,
    method: str,
    results: Dict[str, Any],
    parameters: Optional[Dict[str, Any]] = None,
    anomaly_count: int = 0,
    status: str = "completed",
) -> Analysis:
    import json
    analysis = Analysis(
        signal_id=signal_id,
        owner_id=owner_id,
        method=method,
        results=json.dumps(results),
        parameters=json.dumps(parameters) if parameters else None,
        anomaly_count=anomaly_count,
        status=status,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


async def get_analysis(db: AsyncSession, analysis_id: int) -> Optional[Analysis]:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    return result.scalar_one_or_none()


async def list_analyses(
    db: AsyncSession,
    signal_id: Optional[int] = None,
    owner_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Analysis]:
    query = select(Analysis).order_by(desc(Analysis.created_at))
    if signal_id:
        query = query.where(Analysis.signal_id == signal_id)
    if owner_id:
        query = query.where(Analysis.owner_id == owner_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_audit_log(
    db: AsyncSession,
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log