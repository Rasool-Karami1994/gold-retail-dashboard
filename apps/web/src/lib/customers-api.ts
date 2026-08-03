import { apiFetch, type Paginated } from "./api";
import { normalizeMobile } from "./mobile";

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

/**
 * Finds the one customer who owns a mobile number, or null.
 *
 * `?search=` is a SUBSTRING match across name and mobile, which is right for a
 * directory search box and wrong for identifying a person: "0912" would come
 * back with half the shop. So the match is re-checked here on the normalised
 * number, and anything short of an exact hit counts as "not registered".
 *
 * A small limit rather than 1: the substring may well match several rows, and
 * the exact one is not guaranteed to sort first.
 */
export async function findCustomerByMobile(
  mobile: string,
): Promise<CustomerRow | null> {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return null;

  const { items } = await fetchCustomers({
    page: 1,
    limit: 10,
    search: normalized,
  });

  return items.find((item) => normalizeMobile(item.mobile) === normalized) ?? null;
}

/* ---- Detail -------------------------------------------------------------- */

export interface CustomerDetailCustomer {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  /** Virtual on the model, so it arrives already joined. */
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One of the customer's transactions.
 *
 * These come back **hydrated** rather than lean, which is why `paidAmount`,
 * `remainingAmount` and `balanceDirection` are present at all -- they are
 * virtuals, and an aggregation could not have produced them.
 *
 * `customer` is NOT populated here (only `createdBy` is), so it is absent from
 * this type: on this screen every row belongs to the same person anyway.
 */
export interface CustomerTransaction {
  id: string;
  invoiceNumber: string;
  type: "sell" | "buy";
  goldType: "melted" | "new" | "second-hand";
  goldWeightGrams: number;
  dailyGoldPricePerGram: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  /** Which way an open balance points, already resolved by the model. */
  balanceDirection: "customer-owes-shop" | "shop-owes-customer" | "none";
  status: "open" | "settled";
  invoicePdfUrl: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  customer: CustomerDetailCustomer;
  /**
   * Lifetime figures across ALL the customer's transactions, not just the page
   * below -- computed by their own aggregate on the server. Summing the visible
   * rows instead would silently report "page 1 of their history" as the total.
   */
  totals: {
    transactionCount: number;
    totalPurchased: number;
    totalSold: number;
  };
  transactions: CustomerTransaction[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** The `page`/`limit` here paginate the transaction history, not the customer. */
export function fetchCustomerDetail(
  id: string,
  { page, limit }: { page: number; limit: number },
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  return apiFetch<CustomerDetail>(
    `/api/admin/customers/${encodeURIComponent(id)}?${params.toString()}`,
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
  byMobile: (mobile: string) => ["customers", "by-mobile", mobile] as const,
  // The page is part of the key: it paginates the transaction history, so two
  // pages are two different cache entries for the same customer.
  detail: (id: string, page: number, limit: number) =>
    ["customers", "detail", id, page, limit] as const,
};
