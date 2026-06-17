from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from apps.api.core.config import settings

def get_supabase_client() -> Client:
    """
    Returns a Supabase client initialized with the SERVICE_ROLE_KEY.
    Bypasses RLS. Used for system/admin operations.
    """
    options = ClientOptions(persist_session=False)
    return create_client(
        settings.NEXT_PUBLIC_SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
        options=options
    )

def get_user_supabase_client(jwt_token: str) -> Client:
    """
    Returns a Supabase client acting on behalf of the authenticated user.
    RLS is enforced.
    """
    options = ClientOptions(persist_session=False)
    client = create_client(
        settings.NEXT_PUBLIC_SUPABASE_URL,
        settings.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        options=options
    )
    if jwt_token:
        client.auth.set_session(access_token=jwt_token, refresh_token="")
    return client
