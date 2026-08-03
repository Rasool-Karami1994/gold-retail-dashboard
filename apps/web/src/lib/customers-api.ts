import { apiFetch, type Paginated } from "./api";

/**
 * Customer reads and the two-step "add customer" write.
 *
 * The registration flow spans three calls across two API groups, which is why
 * they live together here rather than beside the auth helpers:
 *
 *   1. POST /api/customer/auth/request-otp  { purpose: 'register' }
 *   2. POST /api/customer/auth/verify-otp   { purpose: 'register' }
 *   3. POST /api/admin/customers
 *
 * Step 3 is what creates the record. Steps 1 and 2 only prove the number
 * answers -- verifying a 'register' code establishes no session and creates no
 * customer, it just leaves a receipt the create endpoint looks for. See
 * `createCustomer` in apps/api/src/services/customer.service.ts.
 */

/* ---- List ---------------------------------------------------------------- */

export interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  createdAt: string;
  updatedAt: string;
  transactionCount: number;
  /**
   * Both totals are from the CUSTOMER's side of the counter, and both are gross
   * deal value rather than what has been settled:
   *   totalPurchased -- bought from the shop ('sell' transactions)
   *   totalSold      -- sold to the shop ('buy' transactions)
   */
  totalPurchased: number;
  totalSold: number;
}

export function fetchCustomers({
  page,
  limit,
  search,
}: {
  page: number;
  limit: number;
  search?: string;
}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  // The API rejects an empty `search`, so omit it rather than sending "".
  if (search) params.set("search", search);

  return apiFetch<Paginated<CustomerRow>>(
    `/api/admin/customers?${params.toString()}`,
  );
}

/* ---- Registration -------------------------------------------------------- */

export interface RequestOtpResult {
  /** Normalised by the API. Use THIS for the later calls, not the raw input. */
  mobile: string;
  purpose: "register";
  expiresAt: string;
  /** Seconds until the code dies, for the resend countdown. */
  expiresInSeconds: number;
}

/**
 * Issues a registration code. Admin-only at the API -- the public login page
 * cannot ask for one, which is what stops a stranger registering themselves.
 */
export function requestRegisterOtp(mobile: string) {
  return apiFetch<RequestOtpResult>("/api/customer/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ mobile, purpose: "register" }),
  });
}

export function verifyRegisterOtp(input: { mobile: string; code: string }) {
  return apiFetch<{ verified: true; mobile: string; purpose: "register" }>(
    "/api/customer/auth/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ ...input, purpose: "register" }),
    },
  );
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  mobile: string;
}

export interface CreatedCustomer {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Creates the record. 403s unless `verifyRegisterOtp` succeeded for this number
 * within the registration window (15 minutes by default), so it cannot be
 * called on its own to add an unverified number.
 */
export function createCustomer(input: CreateCustomerInput) {
  return apiFetch<CreatedCustomer>("/api/admin/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ---- Query keys ---------------------------------------------------------- */

export const customerKeys = {
  all: ["customers"] as const,
  list: (page: number, limit: number, search: string) =>
    ["customers", "list", page, limit, search] as const,
};
