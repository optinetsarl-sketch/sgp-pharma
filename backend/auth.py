import os
from datetime import datetime, timezone, timedelta
from typing import Optional
import bcrypt
import jwt
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel

from database import get_db
from models import LoginRequest, UserPublic, now_utc

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 8  # 8h working day
REFRESH_TTL_DAYS = 7
LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 15


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(
        "access_token", access, httponly=True, secure=False, samesite="lax",
        max_age=ACCESS_TTL_MIN * 60, path="/"
    )
    response.set_cookie(
        "refresh_token", refresh, httponly=True, secure=False, samesite="lax",
        max_age=REFRESH_TTL_DAYS * 86400, path="/"
    )


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    db = get_db()
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user or not user.get("active", True):
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
        return user
    return checker


async def log_audit(user: dict, action: str, entity: Optional[str] = None,
                    entity_id: Optional[str] = None, details: Optional[dict] = None,
                    ip_address: Optional[str] = None):
    db = get_db()
    entry = {
        "id": __import__("uuid").uuid4().hex,
        "user_id": user.get("id") if user else None,
        "user_email": user.get("email") if user else None,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "details": details or {},
        "ip_address": ip_address,
        "created_at": now_utc().isoformat(),
    }
    await db.audit_logs.insert_one(entry)


# ---------- Routes ----------
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    db = get_db()
    email = payload.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    # brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= LOCKOUT_THRESHOLD:
        last = attempt.get("last_at")
        if last and isinstance(last, str):
            last_dt = datetime.fromisoformat(last)
            if datetime.now(timezone.utc) - last_dt < timedelta(minutes=LOCKOUT_MINUTES):
                raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_at": now_utc().isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account disabled")

    await db.login_attempts.delete_one({"identifier": identifier})

    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)

    user.pop("password_hash", None)
    await log_audit(user, "auth.login", ip_address=ip)
    return {"user": user, "access_token": access}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    await log_audit(user, "auth.logout")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    db = get_db()
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(user["id"], user["email"], user["role"])
        response.set_cookie(
            "access_token", access, httponly=True, secure=False, samesite="lax",
            max_age=ACCESS_TTL_MIN * 60, path="/"
        )
        return {"access_token": access}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


async def seed_admin():
    db = get_db()
    # Super admin (OPTINET) — sees all pharmacies
    super_email = "optinet@sgp-pharma.tg"
    super_pwd = "Optinet@2026"
    if not await db.users.find_one({"email": super_email}):
        from models import gen_id
        await db.users.insert_one({
            "id": gen_id(),
            "email": super_email,
            "name": "OPTINET Super Admin",
            "role": "super_admin",
            "pharmacy_id": None,
            "active": True,
            "password_hash": hash_password(super_pwd),
            "created_at": now_utc().isoformat(),
        })

    # Legacy/default admin email kept; assigned to demo pharmacy after seed_demo runs.
    email = os.environ.get("ADMIN_EMAIL", "admin@sgp-pharma.tg").lower()
    password = os.environ.get("ADMIN_PASSWORD", "Admin@2026")
    existing = await db.users.find_one({"email": email})
    if not existing:
        from models import gen_id
        await db.users.insert_one({
            "id": gen_id(),
            "email": email,
            "name": "Admin Pharmacie",
            "role": "admin",
            "pharmacy_id": None,  # will be set during seed_demo
            "active": True,
            "password_hash": hash_password(password),
            "created_at": now_utc().isoformat(),
        })
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(password)}},
        )
