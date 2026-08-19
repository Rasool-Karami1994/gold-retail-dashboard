export const COOKIE_NAMES = {
  admin: "gd_admin_token",
  customer: "gd_customer_token",
} as const;

export type Role = keyof typeof COOKIE_NAMES;

export const ROUTES = {
  customerLogin: "/",
  customerHome: "/customer/transactions",

  adminRoot: "/admin",
  adminLogin: "/admin/login",
  adminHome: "/admin/overview",
  adminDesign: "/admin/design",
} as const;

export const PUBLIC_PATHS: readonly string[] = [
  ROUTES.customerLogin,
  ROUTES.adminLogin,
  "/login",
];

export const RETURN_TO_PARAM = "next";

export const IS_DEV = process.env.NODE_ENV === "development";

const DEV_ONLY_PATHS: readonly string[] = [ROUTES.adminDesign];

export function isDevOnlyPath(pathname: string): boolean {
  return DEV_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isAdminPath(pathname: string): boolean {
  return pathname === ROUTES.adminRoot || pathname.startsWith(`${ROUTES.adminRoot}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
