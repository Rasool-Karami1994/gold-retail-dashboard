import {
  TransactionModel,
  withRemainingFields,
  type TransactionType,
} from "../models/transaction.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { dateRangeClause } from "../lib/date-range.js";

export interface DateRange {
  from?: Date;
  to?: Date;
}

function splitByType(field: string, sellAs: string, buyAs: string) {
  return {
    $group: {
      _id: null,
      [sellAs]: {
        $sum: { $cond: [{ $eq: ["$type", "sell"] }, field, 0] },
      },
      [buyAs]: {
        $sum: { $cond: [{ $eq: ["$type", "buy"] }, field, 0] },
      },
    },
  };
}

function rangeMatch({ from, to }: DateRange) {
  const createdAt = dateRangeClause(from, to);
  return { $match: createdAt ? { createdAt } : {} };
}

export interface VolumeStats {
  soldGrams: number;
  boughtGrams: number;
}

export async function getVolume(range: DateRange): Promise<VolumeStats> {
  const [row] = await TransactionModel.aggregate<VolumeStats>([
    rangeMatch(range),
    splitByType("$goldWeightGrams", "soldGrams", "boughtGrams"),
    { $project: { _id: 0, soldGrams: 1, boughtGrams: 1 } },
  ]);

  return row ?? { soldGrams: 0, boughtGrams: 0 };
}

export interface AmountStats {
  soldAmount: number;
  boughtAmount: number;
}

export async function getAmount(range: DateRange): Promise<AmountStats> {
  const [row] = await TransactionModel.aggregate<AmountStats>([
    rangeMatch(range),
    splitByType("$totalAmount", "soldAmount", "boughtAmount"),
    { $project: { _id: 0, soldAmount: 1, boughtAmount: 1 } },
  ]);

  return row ?? { soldAmount: 0, boughtAmount: 0 };
}

export interface DebtCreditAmount {
  customerDebtToShop: number;
  shopDebtToCustomer: number;
  net: number;
}

export async function getDebtCreditAmount(): Promise<DebtCreditAmount> {
  const [row] = await TransactionModel.aggregate<
    Omit<DebtCreditAmount, "net">
  >([
    { $match: { status: "open" } },
    ...withRemainingFields(),
    splitByType("$remainingAmount", "customerDebtToShop", "shopDebtToCustomer"),
    { $project: { _id: 0, customerDebtToShop: 1, shopDebtToCustomer: 1 } },
  ]);

  const totals = row ?? { customerDebtToShop: 0, shopDebtToCustomer: 0 };

  return {
    ...totals,
    net: round(totals.customerDebtToShop - totals.shopDebtToCustomer, 2),
  };
}

export interface DebtCreditGrams {
  customerDebtToShopGrams: number;
  shopDebtToCustomerGrams: number;
  net: number;
}

export async function getDebtCreditGrams(): Promise<DebtCreditGrams> {
  const [row] = await TransactionModel.aggregate<
    Omit<DebtCreditGrams, "net">
  >([
    { $match: { status: "open" } },
    ...withRemainingFields(),
    splitByType(
      "$remainingGrams",
      "customerDebtToShopGrams",
      "shopDebtToCustomerGrams",
    ),
    {
      $project: {
        _id: 0,
        customerDebtToShopGrams: { $round: ["$customerDebtToShopGrams", 3] },
        shopDebtToCustomerGrams: { $round: ["$shopDebtToCustomerGrams", 3] },
      },
    },
  ]);

  const totals = row ?? {
    customerDebtToShopGrams: 0,
    shopDebtToCustomerGrams: 0,
  };

  return {
    ...totals,
    net: round(
      totals.customerDebtToShopGrams - totals.shopDebtToCustomerGrams,
      3,
    ),
  };
}

export interface OpenTransactionsOptions extends DateRange {
  page: number;
  limit: number;
  type?: TransactionType;
}

export async function listOpenTransactions({
  page,
  limit,
  type,
  from,
  to,
}: OpenTransactionsOptions) {
  const match: Record<string, unknown> = { status: "open" };
  if (type) match.type = type;

  const createdAt = dateRangeClause(from, to);
  if (createdAt) match.createdAt = createdAt;

  const [result] = await TransactionModel.aggregate([
    { $match: match },
    ...withRemainingFields(),
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: CustomerModel.collection.name,
              localField: "customer",
              foreignField: "_id",
              as: "customer",
              pipeline: [
                { $project: { _id: 1, firstName: 1, lastName: 1, mobile: 1 } },
              ],
            },
          },
          { $addFields: { customer: { $first: "$customer" } } },
          {
            $project: {
              _id: 0,
              id: "$_id",
              invoiceNumber: 1,
              customer: 1,
              type: 1,
              goldType: 1,
              status: 1,
              totalAmount: 1,
              paidAmount: 1,
              remainingAmount: 1,
              remainingGrams: 1,
              dailyGoldPricePerGram: 1,
              createdAt: 1,
            },
          },
        ],
        total: [{ $count: "value" }],
      },
    },
  ]);

  const items = result?.items ?? [];
  const total: number = result?.total?.[0]?.value ?? 0;

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
