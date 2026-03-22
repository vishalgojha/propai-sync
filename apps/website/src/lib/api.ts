type ApiError = {
  status: number;
  message: string;
  body?: unknown;
};

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await parseJson(response);
  if (!response.ok) {
    const message =
      (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : null) ||
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) ||
      'Request failed.';
    const error: ApiError = { status: response.status, message, body };
    throw error;
  }
  return body as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiGetAuth<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return handleResponse<T>(response);
}

export async function apiPostAuth<T>(path: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPatchAuth<T>(path: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'PATCH',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPutAuth<T>(path: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDeleteAuth<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return handleResponse<T>(response);
}

export type { ApiError };
