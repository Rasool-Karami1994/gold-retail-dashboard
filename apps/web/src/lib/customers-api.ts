import { apiFetch, type Paginated } from "./api";
import { normalizeMobile } from "./mobile";

export interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  createdAt: string;
  updatedAt: string;
  transactionCount: number;
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
  if (search) params.set("search", search);

  return apiFetch<Paginated<CustomerRow>>(
    `/api/admin/customers?${params.toString()}`,
  );
}

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

export interface CustomerDetailCustomer {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

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
  balanceDirection: "customer-owes-shop" | "shop-owes-customer" | "none";
  status: "open" | "settled";
  invoicePdfUrl: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  customer: CustomerDetailCustomer;
  totals: {
    transactionCount: number;
    totalPurchased: number;
    totalSold: number;
  };
  transactions: CustomerTransaction[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

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

export interface RequestOtpResult {
  mobile: string;
  purpose: "register";
  expiresAt: string;
  expiresInSeconds: number;
  devOtpCode?: string;
}

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

export function createCustomer(input: CreateCustomerInput) {
  return apiFetch<CreatedCustomer>("/api/admin/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export const customerKeys = {
  all: ["customers"] as const,
  list: (page: number, limit: number, search: string) =>
    ["customers", "list", page, limit, search] as const,
  byMobile: (mobile: string) => ["customers", "by-mobile", mobile] as const,
  detail: (id: string, page: number, limit: number) =>
    ["customers", "detail", id, page, limit] as const,
};
