import {
  TransactionModel,
  withRemainingFields,
  type TransactionType,
} from "../models/transaction.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { dateRangeClause } from "../lib/date-range.js";

/**
 * Dashboard figures. Every number here is computed by MongoDB -- these
 * pipelines return one already-shaped document rather than rows for the
 * application to add up, so the cost does not grow with the number of
 * transactions.
 *
 * Two different time semantics live in this file, and mixing them up would
 * quietly produce wrong numbers:
 *
 *   /volume and /amount  -- FLOW. What moved during the requested range.
 *                           Filtered on `createdAt`.
 *   /debt-credit-*       -- STOCK. What is outstanding right now. Deliberately
 *                           NOT date-filtered: a debt from two years ago is
 *                           still owed today, and dropping it because it falls
 *                           outside "this month" would understate the balance.
 */

export interface DateRange {
  from?: Date;
  to?: Date;
}

/** Sums `field` into two buckets, one per transaction type, in one pass. */
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

/**
 * Weight traded in the range.
 *
 * `soldGrams` is gold the shop sold (type 'sell'); `boughtGrams` is gold it
 * bought in (type 'buy') -- both from the shop's point of view, unlike the
 * customer-facing totals on the customers list.
 */
export async function getVolume(range: DateRange): Promise<VolumeStats> {
  const [row] = await TransactionModel.aggregate<VolumeStats>([
    rangeMatch(range),
    splitByType("$goldWeightGrams", "soldGrams", "boughtGrams"),
    { $project: { _id: 0, soldGrams: 1, boughtGrams: 1 } },
  ]);

  // No matching transactions means no group, so the pipeline returns nothing.
  return row ?? { soldGrams: 0, boughtGrams: 0 };
}

export interface AmountStats {
  soldAmount: number;
  boughtAmount: number;
}

/** Gross value traded in the range, in Toman. */
export async function getAmount(range: DateRange): Promise<AmountStats> {
  const [row] = await TransactionModel.aggregate<AmountStats>([
    rangeMatch(range),
    splitByType("$totalAmount", "soldAmount", "boughtAmount"),
    { $project: { _id: 0, soldAmount: 1, boughtAmount: 1 } },
  ]);

  return row ?? { soldAmount: 0, boughtAmount: 0 };
}

export interface DebtCreditAmount {
  /** Owed BY customers TO the shop -- unpaid 'sell' invoices. A receivable. */
  customerDebtToShop: number;
  /** Owed BY the shop TO customers -- unpaid 'buy' invoices. A payable. */
  shopDebtToCustomer: number;
  /** Positive when the shop is owed more than it owes. */
  net: number;
}

/**
 * Outstanding balances in Toman, as of now.
 *
 * Not date-filtered -- see the note at the top of this file.
 */
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

/**
 * The same outstanding balances expressed in grams of gold.
 *
 * Each transaction is converted at its OWN `dailyGoldPricePerGram` -- the rate
 * the deal was struck at -- and only then summed. Converting the aggregate
 * total at today's rate instead would be a different and wrong number, because
 * it would silently restate historic debts at the current gold price.
 */
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
        // Round once at the end; per-row rounding already happened in
        // withRemainingFields, this just tidies the accumulated float.
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
  /** Narrows to one side of the ledger for the per-section detail modals. */
  type?: TransactionType;
}

/**
 * Every unsettled transaction, for the "more details" modals behind the
 * debt/credit tiles.
 *
 * `from`/`to` are optional and off by default, so this matches the running
 * totals it is drilling into. Passing them narrows to invoices *raised* in a
 * period, which is a different question -- one about flow, not stock.
 */
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
      // One round trip for both the page and the count. The $lookup sits
      // inside the items branch, after $skip/$limit, so it joins only the
      // rows actually being returned.
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
          // $lookup always yields an array; flatten to the single match.
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
