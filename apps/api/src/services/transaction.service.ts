import { Types, isValidObjectId } from "mongoose";
import {
  TransactionModel,
  type BankType,
  type GoldType,
  type PaymentMethod,
  type TransactionStatus,
  type TransactionType,
  type TransactionDocument,
} from "../models/transaction.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { HttpError } from "../middleware/error-handler.js";
import { normalizeMobile } from "../lib/mobile.js";
import { escapeRegex } from "../lib/regex.js";
import { dateRangeClause } from "../lib/date-range.js";

/**
 * All database access for transactions.
 *
 * `totalAmount`, `invoiceNumber` and `status` are never set from here -- the
 * schema's pre-validate hook derives all three. See transaction.model.ts for
 * the debt/credit rules that give `remainingAmount` its meaning.
 */

/** Fields safe to show alongside a transaction. Never the whole customer. */
const CUSTOMER_PROJECTION = "firstName lastName mobile";

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  bankType?: BankType;
  destinationCard?: string;
  paidAt?: Date;
}

export interface CreateTransactionInput {
  customer: string;
  type: TransactionType;
  goldType: GoldType;
  goldWeightGrams: number;
  dailyGoldPricePerGram: number;
  payments?: PaymentInput[];
  invoicePdfUrl?: string | null;
}

export async function createTransaction(
  input: CreateTransactionInput,
  createdBy: string,
): Promise<TransactionDocument> {
  if (!isValidObjectId(input.customer)) {
    throw new HttpError(404, "Customer not found");
  }

  // Fail before burning an invoice sequence number on a transaction that
  // cannot exist.
  const customer = await CustomerModel.exists({ _id: input.customer });
  if (!customer) throw new HttpError(404, "Customer not found");

  const transaction = await TransactionModel.create({
    customer: input.customer,
    type: input.type,
    goldType: input.goldType,
    goldWeightGrams: input.goldWeightGrams,
    dailyGoldPricePerGram: input.dailyGoldPricePerGram,
    payments: input.payments ?? [],
    invoicePdfUrl: input.invoicePdfUrl ?? null,
    createdBy,
  });

  await transaction.populate("customer", CUSTOMER_PROJECTION);
  return transaction;
}

/**
 * Adds one instalment and lets the model re-derive `status`.
 *
 * Goes through the document API rather than `$push`, because query-level
 * updates skip the pre-validate hook and would leave `status` stale -- see the
 * note on `addPayment` in transaction.model.ts.
 */
export async function addPayment(
  id: string,
  payment: PaymentInput,
): Promise<TransactionDocument> {
  const transaction = await getTransactionById(id);
  await transaction.addPayment(payment);
  await transaction.populate("customer", CUSTOMER_PROJECTION);
  return transaction;
}

export async function getTransactionById(id: string): Promise<TransactionDocument> {
  if (!isValidObjectId(id)) throw new HttpError(404, "Transaction not found");

  const transaction = await TransactionModel.findById(id);
  if (!transaction) throw new HttpError(404, "Transaction not found");
  return transaction;
}

/** Detail view: the transaction with its customer and issuing admin resolved. */
export async function getTransactionDetail(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Transaction not found");

  const transaction = await TransactionModel.findById(id)
    .populate("customer", CUSTOMER_PROJECTION)
    .populate("createdBy", "username role");

  if (!transaction) throw new HttpError(404, "Transaction not found");
  return transaction;
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

export interface AdminListFilters {
  page: number;
  limit: number;
  customerName?: string;
  customerMobile?: string;
  invoiceNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: TransactionStatus;
  type?: TransactionType;
}

/**
 * Resolves customerName / customerMobile into a set of customer ids.
 *
 * These cannot be filtered with `populate()` -- it runs as a second query
 * after this one, so there is no customer field on a transaction to match
 * against. Resolving ids first turns it into an indexed `$in` here. Returns
 * `null` when neither filter was supplied.
 */
async function resolveCustomerIds(
  name?: string,
  mobile?: string,
): Promise<Types.ObjectId[] | null> {
  if (!name && !mobile) return null;

  const conditions: Record<string, unknown>[] = [];

  if (name) {
    const contains = { $regex: escapeRegex(name.trim()), $options: "i" };
    conditions.push({ $or: [{ firstName: contains }, { lastName: contains }] });
  }

  if (mobile) {
    const normalized = normalizeMobile(mobile);
    // Match the raw term too, so a partial like "0912" still works.
    const terms = normalized && normalized !== mobile ? [normalized, mobile] : [mobile];
    conditions.push({
      $or: terms.map((term) => ({
        mobile: { $regex: escapeRegex(term), $options: "i" },
      })),
    });
  }

  const matches = await CustomerModel.find({ $and: conditions })
    .select("_id")
    .lean();

  return matches.map((customer) => customer._id);
}

export async function listTransactionsForAdmin(filters: AdminListFilters) {
  const query: Record<string, unknown> = {};

  const customerIds = await resolveCustomerIds(
    filters.customerName,
    filters.customerMobile,
  );

  if (customerIds !== null) {
    // No customer matched, so no transaction can. Skip the second round trip.
    if (customerIds.length === 0) return emptyPage(filters);
    query.customer = { $in: customerIds };
  }

  if (filters.invoiceNumber) {
    // Contains rather than exact: staff typically type the trailing sequence
    // ("0007") rather than the full INV-YYYYMMDD-0007.
    query.invoiceNumber = {
      $regex: escapeRegex(filters.invoiceNumber.trim()),
      $options: "i",
    };
  }

  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  const createdAt = dateRangeClause(filters.dateFrom, filters.dateTo);
  if (createdAt) query.createdAt = createdAt;

  return runPagedQuery(query, filters);
}

export interface CustomerListFilters {
  page: number;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
  /** Bounds on `totalAmount`, the gross value of the deal. */
  minAmount?: number;
  maxAmount?: number;
}

/**
 * The signed-in customer's own transactions.
 *
 * `customerId` comes from `req.user`, never from the request, so the scope
 * cannot be widened by a crafted query string.
 */
export async function listTransactionsForCustomer(
  customerId: string,
  filters: CustomerListFilters,
) {
  const query: Record<string, unknown> = { customer: customerId };

  const createdAt = dateRangeClause(filters.dateFrom, filters.dateTo);
  if (createdAt) query.createdAt = createdAt;

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    query.totalAmount = {
      ...(filters.minAmount !== undefined ? { $gte: filters.minAmount } : {}),
      ...(filters.maxAmount !== undefined ? { $lte: filters.maxAmount } : {}),
    };
  }

  return runPagedQuery(query, filters);
}

/**
 * One transaction, but only if it belongs to `customerId`.
 *
 * Answers 404 rather than 403 for someone else's invoice: a 403 would confirm
 * the id exists, which is a customer-enumeration oracle over invoice numbers.
 */
export async function getCustomerTransaction(customerId: string, id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Transaction not found");

  const transaction = await TransactionModel.findOne({
    _id: id,
    customer: customerId,
  }).populate("customer", CUSTOMER_PROJECTION);

  if (!transaction) throw new HttpError(404, "Transaction not found");
  return transaction;
}

/* -------------------------------------------------------------------------- */
/* Shared paging                                                               */
/* -------------------------------------------------------------------------- */

async function runPagedQuery(
  query: Record<string, unknown>,
  { page, limit }: { page: number; limit: number },
) {
  const [items, total] = await Promise.all([
    TransactionModel.find(query)
      // _id breaks ties so paging is stable when createdAt collides.
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("customer", CUSTOMER_PROJECTION),
    TransactionModel.countDocuments(query),
  ]);

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

function emptyPage({ page, limit }: { page: number; limit: number }) {
  return {
    items: [] as TransactionDocument[],
    pagination: { page, limit, total: 0, pages: 0 },
  };
}
