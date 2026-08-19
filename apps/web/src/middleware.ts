import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_NAMES,
  IS_DEV,
  RETURN_TO_PARAM,
  ROUTES,
  isAdminPath,
  isDevOnlyPath,
  isPublicPath,
} from "@/config/routes";
import { readSession } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookies = request.cookies;

  const [admin, customer] = await Promise.all([
    readSession(cookies.get(COOKIE_NAMES.admin)?.value, "admin"),
    readSession(cookies.get(COOKIE_NAMES.customer)?.value, "customer"),
  ]);

  const redirect = (to: string) =>
    NextResponse.redirect(new URL(to, request.url));

  const redirectToLogin = (loginPath: string) => {
    const url = new URL(loginPath, request.url);
    const intended = `${pathname}${search}`;
    if (pathname !== "/") {
      url.searchParams.set(RETURN_TO_PARAM, intended);
    }
    return NextResponse.redirect(url);
  };

  if (!IS_DEV && isDevOnlyPath(pathname)) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }

  if (pathname === "/") {
    if (admin) return redirect(ROUTES.adminHome);
    if (customer) return redirect(ROUTES.customerHome);
    return NextResponse.next();
  }

  if (isAdminPath(pathname)) {
    if (pathname === ROUTES.adminRoot) {
      return admin ? redirect(ROUTES.adminHome) : redirect(ROUTES.adminLogin);
    }

    if (pathname === ROUTES.adminLogin) {
      return admin ? redirect(ROUTES.adminHome) : NextResponse.next();
    }

    return admin ? NextResponse.next() : redirectToLogin(ROUTES.adminLogin);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  return customer ? NextResponse.next() : redirectToLogin(ROUTES.customerLogin);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
};
