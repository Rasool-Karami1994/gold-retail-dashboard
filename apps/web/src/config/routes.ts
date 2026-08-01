/**
 * Route map and cookie names for the middleware guard.
 *
 * The app has two audiences behind one origin:
 *   - the customer app, everything outside /admin
 *   - the staff app, everything under /admin
 *
 * Both are gated in src/middleware.ts. Everything it needs to know lives here,
 * so changing where the login pages sit is a one-file edit.
 */

/**
 * MUST match COOKIE_NAMES in apps/api/src/services/token.service.ts. The API
 * issues these cookies; this app only reads them. They are duplicated rather
 * than shared through a package because the two apps have no build-time
 * dependency on each other -- if you change one, change the other.
 */
export const COOKIE_NAMES = {
  admin: "gd_admin_token",
  customer: "gd_customer_token",
} as const;

export type Role = keyof typeof COOKIE_NAMES;

export const ROUTES = {
  /** Customer login + registration. */
  customerLogin: "/login",
  /** Where a signed-in customer lands. */
  customerHome: "/dashboard",

  adminRoot: "/admin",
  adminLogin: "/admin/login",
  /** Where a signed-in admin lands. */
  adminHome: "/admin/overview",
} as const;

/** Reachable without any session. Everything else needs one. */
export const PUBLIC_PATHS: readonly string[] = [
  ROUTES.customerLogin,
  ROUTES.adminLogin,
];

/**
 * Query parameter carrying the originally requested path through a login
 * redirect, so the login page can send the user back afterwards.
 */
export const RETURN_TO_PARAM = "next";

export function isAdminPath(pathname: string): boolean {
  return pathname === ROUTES.adminRoot || pathname.startsWith(`${ROUTES.adminRoot}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
