import { apiFetch, type Paginated } from "./api";
import { toApiDate, type DateRange } from "./jalali";
import type { TransactionCustomer } from "./transactions-api";

export type { Paginated };

function rangeQuery(range: DateRange, keys: [string, string]): string {
  const params = new URLSearchParams();
  params.set(keys[0], toApiDate(range.from));
  params.set(keys[1], toApiDate(range.to));
  return params.toString();
}

export interface VolumeStats {
  soldGrams: number;
  boughtGrams: number;
}

export interface AmountStats {
  soldAmount: number;
  boughtAmount: number;
}

export function fetchVolume(range: DateRange) {
  return apiFetch<VolumeStats>(
    `/api/admin/stats/volume?${rangeQuery(range, ["from", "to"])}`,
  );
}

export function fetchAmount(range: DateRange) {
  return apiFetch<AmountStats>(
    `/api/admin/stats/amount?${rangeQuery(range, ["from", "to"])}`,
  );
}

export interface DebtCreditAmount {
  customerDebtToShop: number;
  shopDebtToCustomer: number;
  net: number;
}

export interface DebtCreditGrams {
  customerDebtToShopGrams: number;
  shopDebtToCustomerGrams: number;
  net: number;
}

export function fetchDebtCreditAmount() {
  return apiFetch<DebtCreditAmount>("/api/admin/stats/debt-credit-amount");
}

export function fetchDebtCreditGrams() {
  return apiFetch<DebtCreditGrams>("/api/admin/stats/debt-credit-grams");
}

export interface OpenTransactionRow {
  id: string;
  invoiceNumber: string;
  customer: TransactionCustomer | null;
  type: "sell" | "buy";
  goldType: "melted" | "new" | "second-hand";
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  remainingGrams: number;
  dailyGoldPricePerGram: number;
  createdAt: string;
}

export function fetchOpenTransactions({
  page,
  limit,
  type,
}: {
  page: number;
  limit: number;
  type?: "sell" | "buy";
}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (type) params.set("type", type);

  return apiFetch<Paginated<OpenTransactionRow>>(
    `/api/admin/stats/open-transactions?${params.toString()}`,
  );
}

export const statsKeys = {
  volume: (range: DateRange) =>
    ["stats", "volume", toApiDate(range.from), toApiDate(range.to)] as const,
  amount: (range: DateRange) =>
    ["stats", "amount", toApiDate(range.from), toApiDate(range.to)] as const,

  debtCreditAmount: () => ["stats", "debt-credit", "amount"] as const,
  debtCreditGrams: () => ["stats", "debt-credit", "grams"] as const,
  openTransactions: (page: number, limit: number, type?: "sell" | "buy") =>
    ["stats", "open-transactions", page, limit, type ?? "all"] as const,
};
