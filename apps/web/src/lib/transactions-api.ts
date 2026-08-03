import { apiFetch, type Paginated } from "./api";
import { toApiDate } from "./jalali";

/**
 * The transaction list, for admin screens.
 *
 * Lives here rather than in stats-api because it is not a statistic: the
 * overview's range modal and /admin/transactions read the same endpoint, one
 * with a date range and the other with the full filter set. Keeping two
 * fetchers for one endpoint is how their parameter names drift apart.
 */

export interface TransactionCustomer {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

export interface TransactionRow {
  id: string;
  invoiceNumber: string;
  /** Populated by the API. Null only if the customer was deleted. */
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

/**
 * Everything GET /api/admin/transactions filters on. All optional -- an absent
 * field is not sent, which is what the API means by "no filter".
 *
 * NOTE THE PARAM NAMES: this endpoint takes `dateFrom`/`dateTo` while
 * /stats/* takes `from`/`to`. That inconsistency is in the API and is contained
 * in these two modules so no component has to remember which is which.
 */
export interface TransactionFilters {
  customerName?: string;
  customerMobile?: string;
  /** Matched as a substring, so the trailing sequence alone works. */
  invoiceNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: "open" | "settled";
  type?: "sell" | "buy";
}

/**
 * Filters as flat string params.
 *
 * The request and the query key are both built from this, so a cached page can
 * never disagree with the filters that fetched it -- and an empty string is
 * dropped here rather than sent as `?customerName=`, which the API rejects.
 */
export function transactionQuery(
  filters: TransactionFilters,
): Record<string, string> {
  const query: Record<string, string> = {};

  if (filters.customerName) query.customerName = filters.customerName;
  if (filters.customerMobile) query.customerMobile = filters.customerMobile;
  if (filters.invoiceNumber) query.invoiceNumber = filters.invoiceNumber;
  if (filters.dateFrom) query.dateFrom = toApiDate(filters.dateFrom);
  if (filters.dateTo) query.dateTo = toApiDate(filters.dateTo);
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  return query;
}

export function fetchTransactions(
  filters: TransactionFilters,
  { page, limit }: { page: number; limit: number },
) {
  const params = new URLSearchParams({
    ...transactionQuery(filters),
    page: String(page),
    limit: String(limit),
  });

  return apiFetch<Paginated<TransactionRow>>(
    `/api/admin/transactions?${params.toString()}`,
  );
}

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (filters: TransactionFilters, page: number, limit: number) =>
    ["transactions", "list", transactionQuery(filters), page, limit] as const,
};
