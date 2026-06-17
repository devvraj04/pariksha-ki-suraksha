import jwt
from typing import Dict, Any, Optional
from apps.api.core.config import settings

def decode_token_claims(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and cryptographically verifies the JWT token claims.
    Supports center/dev portal RS256 tokens and validates Supabase Auth tokens.
    """
    try:
        # 1. Unverified decode to inspect metadata
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        if not unverified_claims:
            return None
        
        # Developer bypass for mock tokens in non-production environments
        if settings.ENVIRONMENT != "production" and token.endswith(".mock"):
            return unverified_claims
        
        # Extract token headers to check alg
        headers = jwt.get_unverified_header(token)
        alg = headers.get("alg")
        
        # 2. Verify based on algorithm
        if alg == "RS256":
            # Try our public key first
            public_key = settings.ADMIT_CARD_JWT_PUBLIC_KEY.replace("\\n", "\n")
            if public_key.strip():
                try:
                    return jwt.decode(token, public_key, algorithms=["RS256"])
                except jwt.InvalidSignatureError:
                    # Not signed by our key. Try verifying via Supabase Auth
                    pass
                except Exception:
                    return None

        elif alg == "HS256":
            # If in dev/testing, allow the mock-secret-key bypass
            if settings.ENVIRONMENT != "production":
                try:
                    return jwt.decode(token, "mock-secret-key", algorithms=["HS256"])
                except jwt.InvalidSignatureError:
                    pass
                except Exception:
                    return None
        
        # 3. Fallback: Verify via Supabase Auth server (since we don't have the Supabase JWT secret locally)
        from apps.api.core.supabase_client import get_user_supabase_client
        try:
            sb_client = get_user_supabase_client(token)
            auth_res = sb_client.auth.get_user(token)
            if auth_res.user:
                return unverified_claims
        except Exception:
            return None

        return None
    except Exception:
        return None
