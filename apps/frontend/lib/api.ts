import { createClient } from './supabase/client';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let session = null;

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    session = data.session;
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

