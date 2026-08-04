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

/* ---- Detail -------------------------------------------------------------- */

/** A recorded instalment, as it comes back on a transaction. */
export interface TransactionPayment {
  method: "cash" | "bank";
  amount: number;
  bankType?: "paya" | "card-to-card" | "bridge";
  destinationCard?: string;
  paidAt: string;
}

export interface TransactionDetail extends TransactionRow {
  payments: TransactionPayment[];
  balanceDirection: "customer-owes-shop" | "shop-owes-customer" | "none";
  /**
   * Null until the PDF has rendered. The create endpoint starts that render in
   * the background and answers immediately, so a freshly created transaction
   * always has null here and gains a URL on a later read.
   */
  invoicePdfUrl: string | null;
  createdBy?: { id: string; username: string; role: string } | null;
  updatedAt: string;
}

export function fetchTransaction(id: string) {
  return apiFetch<TransactionDetail>(
    `/api/admin/transactions/${encodeURIComponent(id)}`,
  );
}

/* ---- Create -------------------------------------------------------------- */

export interface TransactionPaymentInput {
  method: "cash" | "bank";
  amount: number;
  /** Required by the API for bank payments, rejected on cash ones. */
  bankType?: "paya" | "card-to-card" | "bridge";
  destinationCard?: string;
}

/**
 * `totalAmount`, `invoiceNumber` and `status` are absent on purpose -- all three
 * are derived by the model's pre-validate hook, and the API rejects a body that
 * tries to set them. The total shown on the form is a preview of that
 * calculation, not an input.
 */
export interface CreateTransactionInput {
  /** Customer id, not a mobile: the form resolves the number first. */
  customer: string;
  type: "sell" | "buy";
  goldType: "melted" | "new" | "second-hand";
  goldWeightGrams: number;
  dailyGoldPricePerGram: number;
  payments: TransactionPaymentInput[];
}

export function createTransaction(input: CreateTransactionInput) {
  return apiFetch<TransactionDetail>("/api/admin/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Renders the invoice PDF synchronously and returns its URL.
 *
 * The create endpoint already starts this in the background, so this is the
 * retry for when that render failed and `invoicePdfUrl` never appeared.
 * `notify` is left off: re-rendering should not text the customer a second
 * link.
 */
export function regenerateInvoice(id: string) {
  return apiFetch<{ filename: string; url: string }>(
    `/api/admin/transactions/${encodeURIComponent(id)}/invoice`,
    { method: "POST" },
  );
}

/* ---- The signed-in customer's own transactions --------------------------- */

/**
 * A different endpoint, not a filtered version of the admin one.
 *
 * Scope comes from the session cookie on the server -- there is no customer id
 * in the URL for anyone to substitute, and these filters narrow within that
 * scope rather than choosing it. The row shape is the same, so the admin types
 * above are reused rather than copied.
 */
export interface CustomerTransactionRow extends TransactionRow {
  /** Null until the invoice PDF has rendered. */
  invoicePdfUrl: string | null;
}

export interface CustomerTransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  /** Bounds on `totalAmount`, the gross value of the deal. */
  minAmount?: number;
  maxAmount?: number;
}

/** Request and query key are both built from this, so they cannot disagree. */
export function customerTransactionQuery(
  filters: CustomerTransactionFilters,
): Record<string, string> {
  const query: Record<string, string> = {};

  if (filters.dateFrom) query.dateFrom = toApiDate(filters.dateFrom);
  if (filters.dateTo) query.dateTo = toApiDate(filters.dateTo);
  // Explicit undefined check: 0 is a legitimate bound and must survive.
  if (filters.minAmount !== undefined) query.minAmount = String(filters.minAmount);
  if (filters.maxAmount !== undefined) query.maxAmount = String(filters.maxAmount);

  return query;
}

export function fetchMyTransactions(
  filters: CustomerTransactionFilters,
  { page, limit }: { page: number; limit: number },
) {
  const params = new URLSearchParams({
    ...customerTransactionQuery(filters),
    page: String(page),
    limit: String(limit),
  });

  return apiFetch<Paginated<CustomerTransactionRow>>(
    `/api/customer/transactions?${params.toString()}`,
  );
}

/**
 * One of the customer's own invoices.
 *
 * 404s for someone else's rather than 403 -- a 403 would confirm the id exists,
 * which is an enumeration oracle over invoice numbers. See the service.
 */
export function fetchMyTransaction(id: string) {
  return apiFetch<TransactionDetail>(
    `/api/customer/transactions/${encodeURIComponent(id)}`,
  );
}

/* ---- Query keys ---------------------------------------------------------- */

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (filters: TransactionFilters, page: number, limit: number) =>
    ["transactions", "list", transactionQuery(filters), page, limit] as const,
  detail: (id: string) => ["transactions", "detail", id] as const,
};

/**
 * Kept separate from `transactionKeys`. The two endpoints answer differently
 * for the same id -- one is scoped to a session -- so sharing a cache entry
 * would let an admin's copy of a transaction satisfy a customer's read.
 */
export const myTransactionKeys = {
  all: ["my-transactions"] as const,
  list: (filters: CustomerTransactionFilters, page: number, limit: number) =>
    [
      "my-transactions",
      "list",
      customerTransactionQuery(filters),
      page,
      limit,
    ] as const,
  detail: (id: string) => ["my-transactions", "detail", id] as const,
};
