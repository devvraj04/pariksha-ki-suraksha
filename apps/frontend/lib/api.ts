import { ApiResponse } from '../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let session = null;

  try {
    if (typeof window === 'undefined') {
      // Server-side context
      const { cookies } = await import('next/headers');
      const { createClient } = await import('./supabase/server');
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data } = await supabase.auth.getSession();
      session = data.session;
    } else {
      // Client-side context
      const { createClient } = await import('./supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }
  } catch (err) {
    console.error('Error retrieving Supabase session for apiFetch:', err);
  }

  const headers = new Headers(options.headers);
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // Ensure Content-Type is application/json unless sending FormData (multipart)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${cleanPath}`;

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, fetchOptions);
    
    if (response.status === 204) {
      return {
        success: true,
        data: null,
        error: null,
      };
    }

    const json = await response.json();
    return json as ApiResponse<T>;
  } catch (error: any) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ERR_NETWORK_OR_PARSING_FAILED',
        message: error?.message || 'Network request or response parsing failed.',
      },
    };
  }
}
