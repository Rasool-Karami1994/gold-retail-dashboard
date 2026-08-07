/**
 * Where the browser reaches the API. Required -- there is deliberately no
 * fallback.
 *
 * One variable serves three environments, so a default here would be wrong in
 * at least two of them. It would also be wrong SILENTLY: a missing value in
 * production would compile `http://localhost:4000` into the bundle and every
 * visitor's machine would try to call itself. Failing the build is cheaper.
 *
 *   local dev       http://localhost:4100/api/v1
 *   Docker Compose  http://localhost:4100/api/v1
 *   production      /api          <- relative, served by the Next proxy
 *
 * The production value is relative because next.config.mjs rewrites /api/* to
 * the backend, making every call same-origin so the session cookie stays
 * first-party. An absolute backend origin there would bypass the proxy and put
 * the cookie back on a third-party domain.
 *
 * Read at BUILD time, not at boot -- Next inlines NEXT_PUBLIC_* into the
 * bundle, so changing it means rebuilding and redeploying.
 */
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

/**
 * Prefix every request is built on, with the API's own mount point removed.
 *
 * Callers pass full API paths (`/api/admin/auth/me`), so what is wanted here is
 * everything *before* that -- an origin, or the empty string when the API is
 * same-origin. Both `/api` and `/api/v1` are accepted as the trailing part
 * because the variable is written both ways: `/api/v1` names the versioned
 * base, `/api` just says "under this origin". Stripping only one of them would
 * turn the other into `/api/api/...` at every call site.
 */
const API_ORIGIN = BASE_URL.replace(/\/api(\/v1)?\/?$/, "");

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
    /**
     * The whole `error` object from the response.
     *
     * Some failures carry a fact the UI has to render, not just describe: a
     * rejected payment comes back with the balance that WOULD have fit. Kept as
     * the raw object rather than a named field per case, so a new one does not
     * mean touching this class.
     */
    readonly body?: Record<string, unknown>,
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
 * In production every call is same-origin -- API_ORIGIN is empty and
 * next.config.mjs proxies /api/* to the backend -- so this is really
 * "same-origin" behaviour under a broader name. `include` is kept because the
 * same code runs in all three environments and it is correct in each.
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
      payload?.error,
    );
  }

  return payload as T;
}
