import { apiFetch, type Paginated } from "./api";
import { toApiDate } from "./jalali";

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
  profitPercentage: number;
  profitAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "open" | "settled";
  createdAt: string;
}

export interface TransactionFilters {
  customerName?: string;
  customerMobile?: string;
  invoiceNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: "open" | "settled";
  type?: "sell" | "buy";
}

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

export interface TransactionPayment {
  method: "cash" | "bank";
  amount: number;
  bankType?: "paya" | "card-to-card" | "bridge" | "satna";
  destinationCard?: string;
  destinationIban?: string;
  paidAt: string;
}

export interface TransactionDetail extends TransactionRow {
  payments: TransactionPayment[];
  balanceDirection: "customer-owes-shop" | "shop-owes-customer" | "none";
  invoicePdfUrl: string | null;
  createdBy?: { id: string; username: string; role: string } | null;
  updatedAt: string;
  devInvoiceMessage?: string;
}

export function fetchTransaction(id: string) {
  return apiFetch<TransactionDetail>(
    `/api/admin/transactions/${encodeURIComponent(id)}`,
  );
}

export interface TransactionPaymentInput {
  method: "cash" | "bank";
  amount: number;
  bankType?: "paya" | "card-to-card" | "bridge" | "satna";
  destinationCard?: string;
  destinationIban?: string;
}

export interface CreateTransactionInput {
  customer: string;
  type: "sell" | "buy";
  goldType: "melted" | "new" | "second-hand";
  goldWeightGrams: number;
  dailyGoldPricePerGram: number;
  profitPercentage: number;
  payments: TransactionPaymentInput[];
}

export function createTransaction(input: CreateTransactionInput) {
  return apiFetch<TransactionDetail>("/api/admin/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addPayment(id: string, input: TransactionPaymentInput) {
  return apiFetch<TransactionDetail>(
    `/api/admin/transactions/${encodeURIComponent(id)}/payments`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function regenerateInvoice(id: string) {
  return apiFetch<{ filename: string; url: string }>(
    `/api/admin/transactions/${encodeURIComponent(id)}/invoice`,
    { method: "POST" },
  );
}

export interface CustomerTransactionRow extends TransactionRow {
  invoicePdfUrl: string | null;
}

export interface CustomerTransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export function customerTransactionQuery(
  filters: CustomerTransactionFilters,
): Record<string, string> {
  const query: Record<string, string> = {};

  if (filters.dateFrom) query.dateFrom = toApiDate(filters.dateFrom);
  if (filters.dateTo) query.dateTo = toApiDate(filters.dateTo);
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

export function fetchMyTransaction(id: string) {
  return apiFetch<TransactionDetail>(
    `/api/customer/transactions/${encodeURIComponent(id)}`,
  );
}

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (filters: TransactionFilters, page: number, limit: number) =>
    ["transactions", "list", transactionQuery(filters), page, limit] as const,
  detail: (id: string) => ["transactions", "detail", id] as const,
};

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
