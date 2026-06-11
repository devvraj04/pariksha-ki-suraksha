import os
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from dependencies.db import get_db

# Load internal API key for vision agent security verification
INTERNAL_WORKER_API_KEY = os.getenv("INTERNAL_WORKER_API_KEY", "dev-internal-key")

# HTTPBearer scheme — this is what makes Swagger's Authorize button work
_bearer_scheme = HTTPBearer(auto_error=True)

class AuthenticatedUser:
    def __init__(self, user_id: str, email: str, role: str):
        self.id = user_id
        self.email = email
        self.role = role

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Client = Depends(get_db)
) -> AuthenticatedUser:
    """Base dependency that extracts and validates the Supabase JWT and attaches the user profile role."""
    token = credentials.credentials

    try:
        # Validate session token via GoTrue client
        user_resp = db.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed or token is expired."
            )
        
        user = user_resp.user
        
        # Query user's role from user_profiles table
        profile_resp = db.table("user_profiles").select("role").eq("id", user.id).execute()
        if not profile_resp.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User profile not registered."
            )
        
        role = profile_resp.data[0]["role"]
        return AuthenticatedUser(user_id=user.id, email=user.email, role=role)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}"
        )

# Role enforcement dependencies

def require_super_admin(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super Admin role required."
        )
    return user

def require_authority(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if user.role not in ("authority_a", "authority_b"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Authority credentials required."
        )
    return user

def require_print_operator(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if user.role != "print_operator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Print Operator role required."
        )
    return user

def require_driver(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if user.role != "driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Driver role required."
        )
    return user

def require_supervisor(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if user.role != "supervisor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Supervisor role required."
        )
    return user

def require_internal_worker(
    x_internal_api_key: str = Header(..., alias="X-Internal-API-Key")
) -> str:
    """Enforces header-based internal secret validation for Python edge workers (e.g. vision agent)."""
    if x_internal_api_key != INTERNAL_WORKER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Invalid internal API credential."
        )
    return x_internal_api_key
