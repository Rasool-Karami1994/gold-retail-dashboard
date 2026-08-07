import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_NAMES,
  RETURN_TO_PARAM,
  ROUTES,
  isAdminPath,
  isPublicPath,
} from "@/config/routes";
import { readSession } from "@/lib/session";

/**
 * Route guard for both audiences.
 *
 *   /                 signed out          -> the customer sign-in form
 *                     customer            -> /dashboard
 *                     admin               -> /admin/overview
 *   /admin            signed out          -> /admin/login
 *                     admin               -> /admin/overview
 *   /admin/*          not an admin        -> /admin/login
 *   everything else   not a customer      -> /
 *
 * A signed-in user who lands on a login page is bounced to their own home, so
 * the back button doesn't strand them on a form they don't need.
 *
 * This is a redirect layer, not an authorisation boundary. It only sees whether
 * the JWT verifies -- the API re-checks the same cookie on every call via
 * `authenticate` + `requireRole`. Middleware being bypassed would expose no
 * data on its own.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookies = request.cookies;

  const [admin, customer] = await Promise.all([
    readSession(cookies.get(COOKIE_NAMES.admin)?.value, "admin"),
    readSession(cookies.get(COOKIE_NAMES.customer)?.value, "customer"),
  ]);

  const redirect = (to: string) =>
    NextResponse.redirect(new URL(to, request.url));

  /** Sends the user to `loginPath`, remembering where they were headed. */
  const redirectToLogin = (loginPath: string) => {
    const url = new URL(loginPath, request.url);
    const intended = `${pathname}${search}`;
    // Only worth remembering if it isn't the default landing page anyway.
    if (pathname !== "/") {
      url.searchParams.set(RETURN_TO_PARAM, intended);
    }
    return NextResponse.redirect(url);
  };

  if (pathname === "/") {
    if (admin) return redirect(ROUTES.adminHome);
    if (customer) return redirect(ROUTES.customerHome);
    // Signed out: this IS the sign-in page, so render it. Anyone already signed
    // in is bounced above, so the back button cannot strand them on a form they
    // no longer need.
    return NextResponse.next();
  }

  if (isAdminPath(pathname)) {
    if (pathname === ROUTES.adminRoot) {
      return admin ? redirect(ROUTES.adminHome) : redirect(ROUTES.adminLogin);
    }

    if (pathname === ROUTES.adminLogin) {
      // Already signed in; no reason to show the form.
      return admin ? redirect(ROUTES.adminHome) : NextResponse.next();
    }

    // A customer session is not an admin session -- same redirect either way.
    return admin ? NextResponse.next() : redirectToLogin(ROUTES.adminLogin);
  }

  // No branch for `customerLogin` here: it is "/", which the root block above
  // already answered.

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  return customer ? NextResponse.next() : redirectToLogin(ROUTES.customerLogin);
}

export const config = {
  /**
   * Everything except Next's own assets and files with an extension.
   *
   * `/api` is excluded because this app doesn't serve one -- the Express API is
   * a separate origin. Drop that segment from the pattern if route handlers are
   * ever added here and should be guarded.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
};
