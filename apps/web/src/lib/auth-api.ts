import { apiFetch } from "./api";
import type { AuthUser } from "@/stores/auth.store";

export interface AdminLoginInput {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  admin: { id: string; username: string; role: "admin" };
  smsMock?: boolean;
  insecureOtp?: boolean;
}

export function loginAdmin(input: AdminLoginInput) {
  return apiFetch<AdminLoginResponse>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutAdmin() {
  return apiFetch<void>("/api/admin/auth/logout", { method: "POST" });
}

export function fetchAdminMe() {
  return apiFetch<AdminLoginResponse>("/api/admin/auth/me");
}

export const adminMeKey = ["admin", "me"] as const;

export interface RequestLoginOtpResult {
  mobile: string;
  purpose: "login";
  expiresAt: string;
  expiresInSeconds: number;
  devOtpCode?: string;
}

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

export function fetchCustomerMe() {
  return apiFetch<CustomerMe>("/api/customer/me");
}

export const customerMeKey = ["customer", "me"] as const;

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
