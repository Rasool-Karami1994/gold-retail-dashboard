/**
 * Base URL of the Express API. Required -- there is deliberately no fallback.
 *
 * One variable serves three environments (local dev, Docker Compose, and the
 * deployed frontend calling a different domain), so a default here would be
 * wrong in two of them. It would also be wrong SILENTLY: a missing value in
 * production would quietly compile `http://localhost:4000` into the browser
 * bundle, and every visitor's machine would try to call itself. Failing the
 * build is the cheaper outcome.
 *
 * Read at BUILD time, not at boot -- Next inlines NEXT_PUBLIC_* into the
 * bundle, so changing it means rebuilding and redeploying.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. It must be the API's browser-reachable " +
      "origin plus /api/v1 -- e.g. http://localhost:4100/api/v1 locally, or " +
      "https://g-dash-api.onrender.com/api/v1 in production. Set it in " +
      "apps/web/.env.local, or in the deployment's build environment.",
  );
}

/** Origin of the API, without the /api/v1 suffix -- auth lives at /api/*. */
const API_ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, "");

/**
 * The envelope every paginated list endpoint answers with. Defined here rather
 * than next to any one resource because customers, transactions and the stats
 * lists all share it -- a second copy would be a second thing to keep in sync.
 */
export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Calls the Express API from the browser.
 *
 * `credentials: "include"` is what lets the API's httpOnly auth cookies be set
 * and sent. Cookies ignore port, so in local dev the cookie the API sets on
 * localhost:4100 is sent to localhost:3000 without extra configuration.
 *
 * Across domains it needs both halves to agree: the API must answer with
 * `Access-Control-Allow-Credentials: true` and name this exact origin in
 * `Access-Control-Allow-Origin` (ALLOWED_ORIGIN), and its cookie must carry
 * `SameSite=None; Secure`. Miss either and the browser drops the cookie
 * without surfacing an error the app can catch -- calls simply come back 401.
 */
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
    );
  }

  return payload as T;
}
