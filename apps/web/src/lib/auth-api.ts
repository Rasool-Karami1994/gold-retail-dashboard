import { apiFetch } from "./api";
import type { AuthUser } from "@/stores/auth.store";

/**
 * Auth calls, kept out of the components so the request shapes live in one
 * place and a query key never disagrees with the function that fills it.
 */

export interface AdminLoginInput {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  admin: { id: string; username: string; role: "admin" };
}

/**
 * The API answers with `Set-Cookie` for the httpOnly session; the body is only
 * the principal for display. Nothing here handles a token because nothing in
 * this app can see one.
 */
export function loginAdmin(input: AdminLoginInput) {
  return apiFetch<AdminLoginResponse>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutAdmin() {
  return apiFetch<void>("/api/admin/auth/logout", { method: "POST" });
}

/**
 * Who is signed in. 401s when the cookie is missing, expired or belongs to a
 * deleted account, which is how the shell learns the session is over.
 */
export function fetchAdminMe() {
  return apiFetch<AdminLoginResponse>("/api/admin/auth/me");
}

/** Query key for the session lookup, shared so nothing invalidates a typo. */
export const adminMeKey = ["admin", "me"] as const;

/** Shapes the login response into the store's user. */
export function toAuthUser(response: AdminLoginResponse): AuthUser {
  return {
    id: response.admin.id,
    role: response.admin.role,
    username: response.admin.username,
  };
}
