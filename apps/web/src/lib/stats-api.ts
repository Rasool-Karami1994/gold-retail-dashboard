import { apiFetch } from "./api";
import type { DateRange } from "./jalali";

/**
 * Dashboard statistics and the transaction list behind them.
 *
 * NOTE ON PARAM NAMES: the stats endpoints take `from`/`to` while
 * /api/admin/transactions takes `dateFrom`/`dateTo`. That inconsistency is in
 * the API, and it is contained here so no component has to remember which is
 * which.
 */

/** ISO date, no time -- the API widens a bare date to the whole day. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeQuery(range: DateRange, keys: [string, string]): string {
  const params = new URLSearchParams();
  params.set(keys[0], isoDate(range.from));
  params.set(keys[1], isoDate(range.to));
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

/* ---- Transactions in a range --------------------------------------------- */

export interface TransactionCustomer {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

export interface TransactionRow {
  id: string;
  invoiceNumber: string;
  customer: TransactionCustomer | null;
  type: "sell" | "buy";
  goldType: "melted" | "new" | "second-hand";
  goldWeightGrams: number;
  dailyGoldPricePerGram: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "open" | "settled";
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export function fetchTransactions(
  range: DateRange,
  { page, limit }: { page: number; limit: number },
) {
  const params = new URLSearchParams(
    rangeQuery(range, ["dateFrom", "dateTo"]),
  );
  params.set("page", String(page));
  params.set("limit", String(limit));

  return apiFetch<Paginated<TransactionRow>>(
    `/api/admin/transactions?${params.toString()}`,
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
    ["stats", "volume", isoDate(range.from), isoDate(range.to)] as const,
  amount: (range: DateRange) =>
    ["stats", "amount", isoDate(range.from), isoDate(range.to)] as const,
  transactions: (range: DateRange, page: number, limit: number) =>
    [
      "transactions",
      isoDate(range.from),
      isoDate(range.to),
      page,
      limit,
    ] as const,

  // No range in these keys: the figures are as-of-now, not per-period.
  debtCreditAmount: () => ["stats", "debt-credit", "amount"] as const,
  debtCreditGrams: () => ["stats", "debt-credit", "grams"] as const,
  openTransactions: (page: number, limit: number, type?: "sell" | "buy") =>
    ["stats", "open-transactions", page, limit, type ?? "all"] as const,
};
