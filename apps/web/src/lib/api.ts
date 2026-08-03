const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
 * localhost:4000 is sent to localhost:3000 without extra configuration. In
 * production both apps must be on the same site, or sit behind one proxy.
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
