import { Types, isValidObjectId } from "mongoose";
import { CustomerModel } from "../models/customer.model.js";
import { TransactionModel } from "../models/transaction.model.js";
import { OtpRequestModel } from "../models/otp-request.model.js";
import { HttpError } from "../middleware/error-handler.js";
import { normalizeMobile } from "../lib/mobile.js";
import { escapeRegex } from "../lib/regex.js";
import { env } from "../config/env.js";

export interface ListCustomersOptions {
  page: number;
  limit: number;
  search?: string;
}

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

export async function listCustomers({ page, limit, search }: ListCustomersOptions) {
  const filter = buildSearchFilter(search);

  const [items, total] = await Promise.all([
    CustomerModel.aggregate<CustomerWithAggregates>([
      { $match: filter },
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
  if (!isValidObjectId(id)) throw new HttpError(404, "Customer not found");

  const customer = await CustomerModel.findById(id);
  if (!customer) throw new HttpError(404, "Customer not found");
  return customer;
}

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

  await OtpRequestModel.deleteOne({ _id: proof._id });

  return customer;
}

export interface UpdateCustomerNameInput {
  firstName?: string;
  lastName?: string;
}

export async function updateCustomerName(
  id: string,
  input: UpdateCustomerNameInput,
) {
  const customer = await getCustomerById(id);

  if (input.firstName !== undefined) customer.firstName = input.firstName;
  if (input.lastName !== undefined) customer.lastName = input.lastName;

  return customer.save();
}
