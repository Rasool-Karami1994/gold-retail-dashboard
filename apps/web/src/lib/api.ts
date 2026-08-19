const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Use the API's browser-reachable origin " +
      "plus /api/v1 (e.g. http://localhost:4100/api/v1) when calling it " +
      "directly, or the relative \"/api\" in production, where next.config.mjs " +
      "proxies it. Set it in apps/web/.env.local, or in the deployment's " +
      "build environment.",
  );
}

const API_ORIGIN = BASE_URL.replace(/\/api(\/v1)?\/?$/, "");

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.message ?? `Request failed (${response.status})`,
      payload?.error?.details,
      payload?.error,
    );
  }

  return payload as T;
}
