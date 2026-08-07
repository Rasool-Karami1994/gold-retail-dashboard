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
  /**
   * True when the API is not sending real SMS. Only `/me` sets it; the login
   * response omits it, which is why it is optional.
   */
  smsMock?: boolean;
  /**
   * `smsMock` AND production -- one-time codes are being returned in API
   * responses on a live deployment. Separate from `smsMock` because mocking is
   * unremarkable in development and an open door in production.
   */
  insecureOtp?: boolean;
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

export interface RequestLoginOtpResult {
  /** Normalised by the API. Use THIS to verify, not the raw input. */
  mobile: string;
  purpose: "login";
  expiresAt: string;
  /** Seconds until the code dies, for the resend countdown. */
  expiresInSeconds: number;
  /**
   * Present only when the API is mocking SMS -- nothing was delivered, so this
   * is the only way to finish the flow. Its ABSENCE is what tells the UI a real
   * message went out, so never default it.
   */
  devOtpCode?: string;
}

/**
 * Texts a sign-in code.
 *
 * 404s when no customer owns the number. That is not an edge case to smooth
 * over: customers are created at the counter, so an unknown number means the
 * person has no account yet and the flow has to stop rather than ask for a code
 * that was never sent.
 */
export function requestLoginOtp(mobile: string) {
  return apiFetch<RequestLoginOtpResult>("/api/customer/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ mobile, purpose: "login" }),
  });
}

export interface VerifyLoginOtpResult {
  verified: true;
  mobile: string;
  purpose: "login";
  customer: { id: string; firstName: string; lastName: string; mobile: string };
}

/**
 * Establishes the customer session. Unlike the 'register' purpose, this one
 * sets the customer cookie -- which is why the caller must refresh afterwards,
 * so the middleware sees it on the next request.
 */
export function verifyLoginOtp(input: { mobile: string; code: string }) {
  return apiFetch<VerifyLoginOtpResult>("/api/customer/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ ...input, purpose: "login" }),
  });
}

export function logoutCustomer() {
  return apiFetch<{ success: true }>("/api/customer/auth/logout", {
    method: "POST",
  });
}

export interface CustomerMe {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The signed-in customer's own record. 401s when the cookie is missing, expired
 * or belongs to a deleted account, which is how the shell learns the session is
 * over between navigations.
 */
export function fetchCustomerMe() {
  return apiFetch<CustomerMe>("/api/customer/me");
}

export const customerMeKey = ["customer", "me"] as const;

/**
 * Names only.
 *
 * The API's schema is `.strict()` and rejects any other key -- including
 * `mobile`, which is immutable because it is the customer's login identity.
 * Changing it would hand the account and its history to a different phone.
 */
export interface UpdateCustomerMeInput {
  firstName: string;
  lastName: string;
}

export function updateCustomerMe(input: UpdateCustomerMeInput) {
  return apiFetch<CustomerMe>("/api/customer/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Shapes the customer record into the store's user, as `toAuthUser` does for admins. */
export function toCustomerAuthUser(me: CustomerMe): AuthUser {
  return {
    id: me.id,
    role: "customer",
    firstName: me.firstName,
    lastName: me.lastName,
    mobile: me.mobile,
  };
}

export function toAuthUser(response: AdminLoginResponse): AuthUser {
  return {
    id: response.admin.id,
    role: response.admin.role,
    username: response.admin.username,
  };
}
