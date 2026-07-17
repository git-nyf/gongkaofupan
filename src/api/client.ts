export class ApiError extends Error {
  name = 'ApiError';

  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({
    code: 'unknown',
    message: '请求失败',
  }))) as { code: string; message: string };

  return new ApiError(response.status, body.code, body.message);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, { method: 'POST', body: formData });
  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.json() as Promise<T>;
}
