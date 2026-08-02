import { Types, isValidObjectId } from "mongoose";
import { CustomerModel } from "../models/customer.model.js";
import { TransactionModel } from "../models/transaction.model.js";
import { OtpRequestModel } from "../models/otp-request.model.js";
import { HttpError } from "../middleware/error-handler.js";
import { normalizeMobile } from "../lib/mobile.js";
import { escapeRegex } from "../lib/regex.js";
import { env } from "../config/env.js";

/**
 * All database access for customers. Controllers stay thin.
 *
 * A note on the aggregate names, because they read backwards depending on
 * which side of the counter you stand on. They are from the CUSTOMER's point
 * of view, matching how they are shown in the UI:
 *
 *   totalPurchased -- what the customer bought, i.e. transactions of type
 *                     'sell' (the shop sold to them).
 *   totalSold      -- what the customer sold to the shop, i.e. type 'buy'.
 *
 * Both are gross deal value (`totalAmount`), not amounts settled. What is
 * still owed, and in which direction, is `remainingAmount` per transaction --
 * see the header comment in transaction.model.ts.
 */

export interface ListCustomersOptions {
  page: number;
  limit: number;
  search?: string;
}

/**
 * Builds the `$match` for the search box. Matches a first name, a last name,
 * or a mobile number.
 *
 * Mobile gets two shots: the raw term, and the term normalised to canonical
 * `09XXXXXXXXX` form -- so searching `+98912…` or `912…` finds a customer
 * stored as `0912…`. Names are matched case-insensitively as a substring;
 * the term is regex-escaped first (see lib/regex.ts).
 */
function buildSearchFilter(search?: string): Record<string, unknown> {
  const term = search?.trim();
  if (!term) return {};

  const safe = escapeRegex(term);
  const contains = { $regex: safe, $options: "i" };

  const clauses: Record<string, unknown>[] = [
    { firstName: contains },
    { lastName: contains },
    { mobile: contains },
  ];

  // Only worth a second mobile clause if normalising actually changed it.
  const normalized = normalizeMobile(term);
  if (normalized && normalized !== term) {
    clauses.push({ mobile: { $regex: escapeRegex(normalized), $options: "i" } });
  }

  return { $or: clauses };
}

export interface CustomerWithAggregates {
  id: Types.ObjectId;
  firstName: string;
  lastName: string;
  mobile: string;
  createdAt: Date;
  updatedAt: Date;
  transactionCount: number;
  totalPurchased: number;
  totalSold: number;
}

/**
 * Lists customers with their transaction aggregates.
 *
 * The pipeline paginates BEFORE the `$lookup`, so the join runs against the
 * page's customers rather than the whole collection. The sub-pipeline groups
 * by type inside the join, so at most two rows come back per customer instead
 * of their entire transaction history.
 */
export async function listCustomers({ page, limit, search }: ListCustomersOptions) {
  const filter = buildSearchFilter(search);

  const [items, total] = await Promise.all([
    CustomerModel.aggregate<CustomerWithAggregates>([
      { $match: filter },
      // _id breaks ties so pagination is stable when createdAt collides.
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: TransactionModel.collection.name,
          localField: "_id",
          foreignField: "customer",
          as: "stats",
          pipeline: [
            {
              $group: {
                _id: "$type",
                count: { $sum: 1 },
                total: { $sum: "$totalAmount" },
              },
            },
          ],
        },
      },
      {
        $addFields: {
          transactionCount: { $sum: "$stats.count" },
          totalPurchased: { $sum: sumOfType("sell") },
          totalSold: { $sum: sumOfType("buy") },
        },
      },
      {
        $project: {
          _id: 0,
          id: "$_id",
          firstName: 1,
          lastName: 1,
          mobile: 1,
          createdAt: 1,
          updatedAt: 1,
          transactionCount: 1,
          totalPurchased: 1,
          totalSold: 1,
        },
      },
    ]),
    CustomerModel.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/** Pulls the `total` out of the grouped stats row for one transaction type. */
function sumOfType(type: "sell" | "buy") {
  return {
    $map: {
      input: {
        $filter: {
          input: "$stats",
          as: "s",
          cond: { $eq: ["$$s._id", type] },
        },
      },
      as: "s",
      in: "$$s.total",
    },
  };
}

export async function getCustomerById(id: string) {
  // Mongoose throws a CastError on a malformed id; 404 is the honest answer.
  if (!isValidObjectId(id)) throw new HttpError(404, "Customer not found");

  const customer = await CustomerModel.findById(id);
  if (!customer) throw new HttpError(404, "Customer not found");
  return customer;
}

/**
 * One customer plus a page of their transactions, newest first.
 *
 * Transactions are returned hydrated rather than lean so the `paidAmount`,
 * `remainingAmount` and `balanceDirection` virtuals are present -- a history
 * without the outstanding balance would be the wrong answer for this screen.
 */
export async function getCustomerDetail(
  id: string,
  { page, limit }: { page: number; limit: number },
) {
  const customer = await getCustomerById(id);

  const [transactions, total] = await Promise.all([
    TransactionModel.find({ customer: customer._id })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("createdBy", "username role"),
    TransactionModel.countDocuments({ customer: customer._id }),
  ]);

  const totals = await aggregateTotalsFor(customer._id);

  return {
    customer,
    totals,
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/** The same three aggregates as the list, for a single customer. */
async function aggregateTotalsFor(customerId: Types.ObjectId) {
  const rows = await TransactionModel.aggregate<{
    _id: "sell" | "buy";
    count: number;
    total: number;
  }>([
    { $match: { customer: customerId } },
    { $group: { _id: "$type", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
  ]);

  const of = (type: "sell" | "buy") => rows.find((row) => row._id === type);

  return {
    transactionCount: rows.reduce((sum, row) => sum + row.count, 0),
    totalPurchased: of("sell")?.total ?? 0,
    totalSold: of("buy")?.total ?? 0,
  };
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  mobile: string;
}

/**
 * Creates a customer, but only if the mobile was recently proved.
 *
 * This is the second half of the staff add-customer flow: the admin requests a
 * 'register' code, the customer reads it back, and only then does this run.
 * Without the OTP check an admin could add arbitrary numbers to the system,
 * and the customer would later be able to sign in to an account they never
 * asked for.
 */
export async function createCustomer(input: CreateCustomerInput) {
  const mobile = normalizeMobile(input.mobile);

  const existing = await CustomerModel.exists({ mobile });
  if (existing) {
    throw new HttpError(409, "A customer with this mobile number already exists");
  }

  const cutoff = new Date(
    Date.now() - env.REGISTRATION_WINDOW_MINUTES * 60 * 1000,
  );

  const proof = await OtpRequestModel.findOne({
    mobile,
    purpose: "register",
    verified: true,
    verifiedAt: { $gte: cutoff },
  }).sort({ verifiedAt: -1 });

  if (!proof) {
    throw new HttpError(
      403,
      "This mobile number has not been verified. Request and confirm a registration code first.",
    );
  }

  const customer = await CustomerModel.create({
    firstName: input.firstName,
    lastName: input.lastName,
    mobile,
  });

  // Burn the proof so it cannot create a second account. Done after the insert
  // rather than before: a standalone mongod has no transactions, and the unique
  // index on `mobile` already makes a duplicate impossible, so the safer
  // failure mode is a spent code surviving a failed insert.
  await OtpRequestModel.deleteOne({ _id: proof._id });

  return customer;
}

export interface UpdateCustomerNameInput {
  firstName?: string;
  lastName?: string;
}

/**
 * Renames a customer.
 *
 * `mobile` is deliberately not updatable here or anywhere else: it is the
 * customer's login identity, so changing it would silently hand their account
 * and transaction history to a different phone. A genuine number change should
 * go through the same OTP proof a registration does -- that flow does not
 * exist yet.
 */
export async function updateCustomerName(
  id: string,
  input: UpdateCustomerNameInput,
) {
  const customer = await getCustomerById(id);

  if (input.firstName !== undefined) customer.firstName = input.firstName;
  if (input.lastName !== undefined) customer.lastName = input.lastName;

  return customer.save();
}
