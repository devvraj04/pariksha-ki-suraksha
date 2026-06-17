from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
import redis
from apps.api.core.config import settings
from apps.api.core.security import decode_token_claims
from apps.api.core.supabase_client import get_supabase_client, get_user_supabase_client

security_bearer = HTTPBearer(auto_error=False)

# Real Redis client
_real_redis_client = redis.from_url(settings.REDIS_URL)

class FallbackRedis:
    def __init__(self, real_client):
        self.real_client = real_client
        self.memory = {}
        self.expirations = {}

    def _execute(self, method_name, *args, **kwargs):
        import time
        from redis.exceptions import ConnectionError, TimeoutError
        try:
            # Clean up expired keys
            now = time.time()
            expired_keys = [k for k, exp in self.expirations.items() if exp < now]
            for k in expired_keys:
                self.memory.pop(k, None)
                self.expirations.pop(k, None)
                
            method = getattr(self.real_client, method_name)
            return method(*args, **kwargs)
        except (ConnectionError, TimeoutError, OSError, Exception) as e:
            # Fallback to local memory
            if method_name == "get":
                key = args[0]
                val = self.memory.get(key)
                if val is not None and isinstance(val, str):
                    return val.encode("utf-8")
                return val
            elif method_name == "set":
                key, val = args[0], args[1]
                if isinstance(val, bytes):
                    val = val.decode("utf-8")
                self.memory[key] = val
                ex = kwargs.get("ex") or (args[2] if len(args) > 2 else None)
                if ex:
                    self.expirations[key] = time.time() + ex
                return True
            elif method_name == "delete":
                for key in args:
                    self.memory.pop(key, None)
                    self.expirations.pop(key, None)
                return 1
            elif method_name == "incr":
                key = args[0]
                val = self.memory.get(key, 0)
                try:
                    new_val = int(val) + 1
                except Exception:
                    new_val = 1
                self.memory[key] = str(new_val)
                return new_val
            elif method_name == "expire":
                key, seconds = args[0], args[1]
                if key in self.memory:
                    self.expirations[key] = time.time() + seconds
                return 1
            return None

    def get(self, *args, **kwargs):
        return self._execute("get", *args, **kwargs)

    def set(self, *args, **kwargs):
        return self._execute("set", *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self._execute("delete", *args, **kwargs)

    def incr(self, *args, **kwargs):
        return self._execute("incr", *args, **kwargs)

    def expire(self, *args, **kwargs):
        return self._execute("expire", *args, **kwargs)

redis_client = FallbackRedis(_real_redis_client)

def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> bool:
    """
    Checks if a given key has exceeded the rate limit using Redis window counting.
    Returns True if allowed, False if rate limited.
    """
    try:
        current = redis_client.get(key)
        if current is not None:
            if int(current) >= max_requests:
                return False
            redis_client.incr(key)
        else:
            redis_client.set(key, 1, ex=window_seconds)
        return True
    except Exception as e:
        print(f"Rate limiter redis error: {e}")
        return True

def RequireInternalKey(request: Request):
    """
    Dependency that checks if the request header contains a valid internal service key.
    """
    auth_key = request.headers.get("X-Internal-Key")
    expected_key = settings.INTERNAL_SERVICE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY
    if not auth_key or auth_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service authorization key."
        )
    return auth_key

class CurrentUser(BaseModel):
    id: str
    role: str
    email: Optional[str] = None
    agency_id: Optional[str] = None
    center_id: Optional[str] = None
    exam_scope: List[str] = []
    paper_batch_ids: List[str] = []
    token: str

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> CurrentUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials"
        )
    token = credentials.credentials
    claims = decode_token_claims(token)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )
        
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user subject ID"
        )
        
    app_metadata = claims.get("app_metadata", {})
    user_metadata = claims.get("user_metadata", {})
    
    # In Supabase custom claims, they could be top-level or in app_metadata
    role = claims.get("role") or app_metadata.get("role") or user_metadata.get("role") or "student"
    email = claims.get("email")
    agency_id = claims.get("agency_id") or app_metadata.get("agency_id") or user_metadata.get("agency_id")
    center_id = claims.get("center_id") or app_metadata.get("center_id") or user_metadata.get("center_id")
    exam_scope = claims.get("exam_scope") or app_metadata.get("exam_scope") or user_metadata.get("exam_scope") or []
    paper_batch_ids = claims.get("paper_batch_ids") or app_metadata.get("paper_batch_ids") or user_metadata.get("paper_batch_ids") or []
    
    return CurrentUser(
        id=user_id,
        role=role,
        email=email,
        agency_id=agency_id,
        center_id=center_id,
        exam_scope=exam_scope,
        paper_batch_ids=paper_batch_ids,
        token=token
    )

class RequireRole:
    def __init__(self, *allowed_roles: str):
        self.allowed_roles = allowed_roles
        
    def __call__(self, current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized to access this resource"
            )
        return current_user

def get_service_db() -> Client:
    """
    Dependency that returns a Supabase client using the service role key.
    Bypasses RLS.
    """
    return get_supabase_client()

def get_agency_scoped_db(current_user: CurrentUser = Depends(get_current_user)) -> Client:
    """
    Dependency that returns a Supabase client scoped to the authenticated user.
    Enforces RLS.
    """
    return get_user_supabase_client(current_user.token)

def log_audit(
    event_type: str,
    event_description: str,
    metadata: Optional[dict] = None,
    actor_id: Optional[str] = None,
    agency_id: Optional[str] = None,
    exam_id: Optional[str] = None,
    ip_address: Optional[str] = None
):
    try:
        supabase = get_supabase_client()
        supabase.table("audit_logs").insert({
            "event_type": event_type,
            "event_description": event_description,
            "metadata": metadata or {},
            "actor_id": actor_id,
            "agency_id": agency_id,
            "exam_id": exam_id,
            "ip_address": ip_address
        }).execute()
    except Exception as e:
        print(f"Failed to write audit log: {e}")
