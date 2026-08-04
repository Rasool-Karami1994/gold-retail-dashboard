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
  /**
   * Customer sign-in, and the site's front door.
   *
   * There is no separate landing page because there is nothing to land on: a
   * customer either signs in or has no business here. Registration is not on it
   * either -- 'register' codes are admin-only at the API, so a self-service form
   * would be a button that always 403s.
   */
  customerLogin: "/",
  /** Where a signed-in customer lands. */
  customerHome: "/dashboard",

  adminRoot: "/admin",
  adminLogin: "/admin/login",
  /** Where a signed-in admin lands. */
  adminHome: "/admin/overview",
} as const;

/**
 * Reachable without any session. Everything else needs one.
 *
 * `customerLogin` is "/", which `isPublicPath` matches only exactly -- the
 * prefix arm below would need a path to begin "//" to match, and none does. The
 * middleware handles the root before consulting this anyway; it is listed for
 * the sake of this list meaning what it says.
 */
export const PUBLIC_PATHS: readonly string[] = [
  ROUTES.customerLogin,
  ROUTES.adminLogin,
  // Where customer sign-in used to live; the page there only redirects to the
  // root. Public so an old link resolves in one hop rather than bouncing
  // through `/?next=/login`.
  "/login",
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
