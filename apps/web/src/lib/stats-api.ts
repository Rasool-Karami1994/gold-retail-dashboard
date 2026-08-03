import { apiFetch, type Paginated } from "./api";
import { toApiDate, type DateRange } from "./jalali";
import type { TransactionCustomer } from "./transactions-api";

/** Re-exported so existing importers keep their single import path. */
export type { Paginated };

/**
 * Dashboard statistics.
 *
 * The transaction LIST these sit alongside lives in transactions-api.ts -- it
 * is not a statistic, and both this file's modal and /admin/transactions read
 * it. Only the aggregate endpoints are here.
 *
 * NOTE ON PARAM NAMES: the stats endpoints take `from`/`to` while
 * /api/admin/transactions takes `dateFrom`/`dateTo`. That inconsistency is in
 * the API, and the two modules contain it so no component has to remember which
 * is which.
 */

function rangeQuery(range: DateRange, keys: [string, string]): string {
  const params = new URLSearchParams();
  params.set(keys[0], toApiDate(range.from));
  params.set(keys[1], toApiDate(range.to));
  return params.toString();
}

/* ---- Volume and amount --------------------------------------------------- */

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

/* ---- Outstanding balances ------------------------------------------------ */

/**
 * These two take no range. They are running totals as of now, not flow through
 * a period -- a debt raised last year is still owed today, so filtering them by
 * date would understate the balance. See stats.service.ts on the API side.
 */

export interface DebtCreditAmount {
  /** Owed BY customers TO the shop -- unpaid 'sell' invoices. A receivable. */
  customerDebtToShop: number;
  /** Owed BY the shop TO customers -- unpaid 'buy' invoices. A payable. */
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

/* ---- Open transactions --------------------------------------------------- */

export interface OpenTransactionRow {
  id: string;
  invoiceNumber: string;
  customer: TransactionCustomer | null;
  type: "sell" | "buy";
  goldType: "melted" | "new" | "second-hand";
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  /** The remainder valued at the rate that deal was struck at. */
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
  /** Omit for both sides of the ledger. */
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

/* ---- Query keys ---------------------------------------------------------- */

/**
 * Keyed by the range's endpoints rather than the whole object -- a `DateRange`
 * carries fresh `Date` instances on every render, and TanStack hashes keys
 * structurally, so passing the object itself would miss the cache every time.
 */
export const statsKeys = {
  volume: (range: DateRange) =>
    ["stats", "volume", toApiDate(range.from), toApiDate(range.to)] as const,
  amount: (range: DateRange) =>
    ["stats", "amount", toApiDate(range.from), toApiDate(range.to)] as const,

  // No range in these keys: the figures are as-of-now, not per-period.
  debtCreditAmount: () => ["stats", "debt-credit", "amount"] as const,
  debtCreditGrams: () => ["stats", "debt-credit", "grams"] as const,
  openTransactions: (page: number, limit: number, type?: "sell" | "buy") =>
    ["stats", "open-transactions", page, limit, type ?? "all"] as const,
};
