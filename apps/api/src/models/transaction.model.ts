import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { nextSequence } from "./counter.model.js";
import { CustomerModel } from "./customer.model.js";
import { normalizeMobile } from "../lib/mobile.js";

/**
 * A single counter-transaction between the shop and a customer.
 *
 * ---------------------------------------------------------------------------
 * DEBT / CREDIT LOGIC
 * ---------------------------------------------------------------------------
 * `totalAmount` is what the deal is worth; `paidAmount` is how much has changed
 * hands so far; `remainingAmount` is the difference. What a non-zero remainder
 * *means* depends entirely on `type`, because `type` says which direction the
 * gold moved:
 *
 *   type 'sell'  -- the shop sold gold to the customer.
 *                   remainingAmount > 0  =>  THE CUSTOMER OWES THE SHOP.
 *                   This is a receivable. It is money the shop is still waiting
 *                   to collect.
 *
 *   type 'buy'   -- the shop bought gold from the customer.
 *                   remainingAmount > 0  =>  THE SHOP OWES THE CUSTOMER.
 *                   This is a payable. It is money the shop still has to hand
 *                   over.
 *
 * In both cases `remainingAmount === 0` means nobody owes anybody and `status`
 * flips to 'settled'. The sign is never negative in normal operation; an
 * overpayment clamps to settled rather than reversing the direction, because a
 * refund is its own transaction, not a negative balance on this one.
 *
 * So a customer's overall position is NOT the sum of `remainingAmount` across
 * their transactions -- the 'sell' remainders and the 'buy' remainders point in
 * opposite directions and must be netted with the sign applied:
 *
 *   net = Σ(sell.remainingAmount) - Σ(buy.remainingAmount)
 *
 * net > 0 means the customer is in debt to the shop; net < 0 means the shop is
 * in debt to the customer. `netBalanceForCustomer()` below does exactly this.
 * ---------------------------------------------------------------------------
 */

export const TRANSACTION_TYPES = ["sell", "buy"] as const;
export const GOLD_TYPES = ["melted", "new", "second-hand"] as const;
export const PAYMENT_METHODS = ["cash", "bank"] as const;
export const BANK_TYPES = ["paya", "card-to-card", "bridge"] as const;
export const TRANSACTION_STATUSES = ["open", "settled"] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type GoldType = (typeof GOLD_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type BankType = (typeof BANK_TYPES)[number];
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/**
 * Amounts are Toman. Money is stored as a JS number, which is a float, so
 * `weight * pricePerGram` is rounded to whole Toman on write and comparisons
 * use a tolerance rather than `=== 0`. Sub-Toman precision has no meaning at a
 * gold counter, and this keeps 0.0000001 remainders from parking an invoice in
 * 'open' forever.
 */
const SETTLEMENT_TOLERANCE = 0.5;

/** Invoice dates follow the shop's wall clock, not the server's UTC day. */
const INVOICE_TIMEZONE = "Asia/Tehran";

/**
 * One instalment against the parent transaction. Recorded as a subdocument
 * rather than its own collection because a payment has no life of its own --
 * it is never queried except through its invoice, and the whole set is needed
 * on every read anyway to compute the remainder.
 */
const paymentSchema = new Schema(
  {
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Payment amount cannot be negative"],
    },

    // Bank-only fields. Required when method is 'bank', stripped when 'cash'
    // (see the pre-validate hook below) so a cash row can never carry a stale
    // card number from an edited entry.
    bankType: {
      type: String,
      enum: BANK_TYPES,
      required: function (this: { method?: PaymentMethod }) {
        return this.method === "bank";
      },
    },

    /**
     * Where the money landed, recorded two ways because the two bank routes
     * identify an account differently.
     *
     * A card-to-card transfer names a card; paya and bridge settle to an IBAN
     * and have no card in the transaction at all. They are separate fields
     * rather than one loosely-typed column because everything downstream has to
     * tell them apart -- the invoice prints "کارت ****1234" for one and "شبا"
     * for the other, and a single column would make every reader sniff the
     * format to know which it was holding.
     */
    destinationCard: {
      type: String,
      trim: true,
      // The shop's own receiving card, so this is not customer PAN data. Still
      // stored as the 16 digits only -- no expiry, no CVV, ever.
      match: [/^\d{16}$/, "Destination card must be 16 digits"],
    },

    destinationIban: {
      type: String,
      trim: true,
      uppercase: true,
      // Iranian IBAN ("شبا"): the literal IR, then 24 digits, 26 characters in
      // all. Stored bare -- no spaces, no IR- prefix variants -- so two records
      // of the same account compare equal.
      match: [/^IR\d{24}$/, "Destination IBAN must be IR followed by 24 digits"],
    },

    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: true },
);

// Cash payments carry no bank metadata; drop anything that slipped through.
paymentSchema.pre("validate", function (next) {
  if (this.method === "cash") {
    this.bankType = undefined;
    this.destinationCard = undefined;
    this.destinationIban = undefined;
  }
  next();
});

const transactionSchema = new Schema(
  {
    /**
     * `INV-YYYYMMDD-XXXX`, e.g. `INV-20260801-0007`. Generated in the
     * pre-validate hook from an atomic per-day counter, so concurrent inserts
     * cannot collide. Never assign this by hand.
     */
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^INV-\d{8}-\d{4}$/, "Invoice number must look like INV-YYYYMMDD-XXXX"],
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    /** Direction of the deal. Drives the whole debt/credit reading -- see above. */
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },

    goldType: {
      type: String,
      enum: GOLD_TYPES,
      required: true,
    },

    goldWeightGrams: {
      type: Number,
      required: true,
      min: [0, "Weight cannot be negative"],
    },

    /** The shop's quoted rate on the day of the deal, in Toman per gram. */
    dailyGoldPricePerGram: {
      type: Number,
      required: true,
      min: [0, "Price per gram cannot be negative"],
    },

    /**
     * Computed as `goldWeightGrams * dailyGoldPricePerGram` in pre-validate.
     * Stored rather than virtual so it can be summed, sorted and indexed --
     * and so a historical invoice keeps its value if the schema's rounding
     * rules ever change.
     */
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    /**
     * Derived from the payments, recomputed on every document save. Stored
     * rather than virtual because virtuals cannot be queried or indexed, and
     * "show me every open invoice" is the single most common filter in the app.
     *
     * See the caveat on `addPayment()` about keeping this honest.
     */
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: "open",
    },

    /** Set once the PDF has been rendered and uploaded; null until then. */
    invoicePdfUrl: {
      type: String,
      trim: true,
      default: null,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

/** Sum of every recorded instalment. */
transactionSchema.virtual("paidAmount").get(function () {
  return (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
});

/**
 * What is still outstanding. Who owes it depends on `type` -- see the header
 * comment. Clamped at zero: an overpayment does not become a negative debt.
 */
transactionSchema.virtual("remainingAmount").get(function () {
  const paid = (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
  return Math.max(0, Math.round((this.totalAmount - paid) * 100) / 100);
});

/**
 * Direction of the outstanding balance, as plain English for the UI:
 *   'customer-owes-shop' | 'shop-owes-customer' | 'none'
 */
transactionSchema.virtual("balanceDirection").get(function () {
  const paid = (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
  const remaining = this.totalAmount - paid;

  if (remaining <= SETTLEMENT_TOLERANCE) return "none";
  return this.type === "sell" ? "customer-owes-shop" : "shop-owes-customer";
});

/**
 * The virtuals above exist only on a hydrated document, so an aggregation
 * pipeline cannot see them -- it runs inside MongoDB, where `remainingAmount`
 * is not a stored field. Reporting queries therefore have to recompute it.
 *
 * These stages are that recomputation, and they live here rather than in the
 * stats service so the two definitions sit within a screen of each other.
 *
 *   !! If you change the `remainingAmount` virtual above, change this too. !!
 *
 * The arithmetic is deliberately identical: subtract, round to 2 decimals,
 * then clamp at zero so an overpayment reads as settled rather than as a
 * negative debt.
 */
export function withRemainingFields() {
  return [
    { $addFields: { paidAmount: { $sum: "$payments.amount" } } },
    {
      $addFields: {
        remainingAmount: {
          $max: [
            0,
            { $round: [{ $subtract: ["$totalAmount", "$paidAmount"] }, 2] },
          ],
        },
      },
    },
    {
      $addFields: {
        /**
         * What the outstanding balance is worth in gold, valued at the rate
         * the deal itself was struck at -- not today's rate. A debt agreed at
         * last year's price is still that many grams.
         *
         * The guard is not paranoia: `dailyGoldPricePerGram` has `min: 0`, and
         * dividing by zero in an aggregation yields an error that kills the
         * whole pipeline rather than one row.
         */
        remainingGrams: {
          $cond: [
            { $gt: ["$dailyGoldPricePerGram", 0] },
            {
              $round: [
                { $divide: ["$remainingAmount", "$dailyGoldPricePerGram"] },
                3,
              ],
            },
            0,
          ],
        },
      },
    },
  ];
}

transactionSchema.pre("validate", async function (next) {
  // Recompute the total whenever either input moves. Rounded to whole Toman.
  if (
    this.isNew ||
    this.isModified("goldWeightGrams") ||
    this.isModified("dailyGoldPricePerGram")
  ) {
    this.totalAmount = Math.round(
      this.goldWeightGrams * this.dailyGoldPricePerGram,
    );
  }

  // Derive status from the payments on every save.
  const paid = (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
  this.status =
    this.totalAmount - paid <= SETTLEMENT_TOLERANCE ? "settled" : "open";

  // Assign the invoice number last, so a document that fails validation for
  // another reason has not already burned a sequence value.
  if (this.isNew && !this.invoiceNumber) {
    this.invoiceNumber = await generateInvoiceNumber();
  }

  next();
});

/** `INV-YYYYMMDD-XXXX` on the shop's local day, with an atomic per-day sequence. */
async function generateInvoiceNumber(when = new Date()): Promise<string> {
  // en-CA renders as YYYY-MM-DD, which is the cheapest way to get a
  // zero-padded date in a specific timezone.
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: INVOICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(when)
    .replace(/-/g, "");

  const seq = await nextSequence(`invoice:${stamp}`);
  return `INV-${stamp}-${String(seq).padStart(4, "0")}`;
}

// `invoiceNumber` is already indexed by `unique: true` on the field.

// Customer statement: every invoice for one customer, newest first.
transactionSchema.index({ customer: 1, createdAt: -1 });

// Same, narrowed to what is still outstanding -- the debt/credit report.
transactionSchema.index({ customer: 1, status: 1, type: 1 });

// Dashboard list and date-range reports.
transactionSchema.index({ createdAt: -1 });

// The common filter combinations on the transactions table.
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1, createdAt: -1 });

// Per-cashier daily reconcile.
transactionSchema.index({ createdBy: 1, createdAt: -1 });

// Turnover by product category.
transactionSchema.index({ goldType: 1, createdAt: -1 });

/**
 * NOTE ON FILTERING BY CUSTOMER MOBILE
 *
 * There is deliberately no index here for it, because there cannot be one.
 * `populate()` is not a join -- Mongoose issues a second query against the
 * customers collection after this one returns, so `Transaction` has no mobile
 * field to index and `.find({ "customer.mobile": … })` matches nothing.
 *
 * Resolve the customer first and filter on the id (the unique index on
 * `Customer.mobile` makes the lookup a point query) -- that is what
 * `findByCustomerMobile()` below does. `$lookup` in an aggregation works too,
 * but it is slower here and buys nothing.
 *
 * If mobile search ever becomes hot enough to matter, denormalise it onto this
 * schema as `customerMobile` and index that -- at the cost of having to
 * rewrite it whenever a customer changes their number.
 */

export type Payment = InferSchemaType<typeof paymentSchema>;
export type Transaction = InferSchemaType<typeof transactionSchema>;

export interface TransactionVirtuals {
  paidAmount: number;
  remainingAmount: number;
  balanceDirection: "customer-owes-shop" | "shop-owes-customer" | "none";
}

export interface TransactionMethods {
  addPayment(payment: {
    method: PaymentMethod;
    amount: number;
    bankType?: BankType;
    destinationCard?: string;
    destinationIban?: string;
    paidAt?: Date;
  }): Promise<TransactionDocument>;
}

export type TransactionDocument = HydratedDocument<
  Transaction,
  TransactionMethods & TransactionVirtuals
>;

export interface TransactionModelType
  extends Model<Transaction, {}, TransactionMethods, TransactionVirtuals> {
  findByCustomerMobile(
    mobile: string,
    filter?: Record<string, unknown>,
  ): Promise<TransactionDocument[]>;

  netBalanceForCustomer(customerId: Types.ObjectId | string): Promise<{
    customerOwesShop: number;
    shopOwesCustomer: number;
    net: number;
  }>;
}

/**
 * Records an instalment and re-derives `status`.
 *
 * IMPORTANT: `status` is kept correct by the document pre-validate hook, which
 * query-level updates do NOT run. `Transaction.updateOne({ $push: { payments }})`
 * will write the payment and leave `status` stale. Always add payments through
 * this method (or load the document, mutate, and `save()`).
 */
transactionSchema.methods.addPayment = async function (
  this: TransactionDocument,
  payment: Parameters<TransactionMethods["addPayment"]>[0],
) {
  this.payments.push({ paidAt: new Date(), ...payment });
  return this.save();
};

transactionSchema.statics.findByCustomerMobile = async function (
  mobile: string,
  filter: Record<string, unknown> = {},
) {
  // Point query on the unique index, then a normal indexed query here.
  const customer = await CustomerModel.findOne({
    mobile: normalizeMobile(mobile),
  })
    .select("_id")
    .lean();

  if (!customer) return [];

  return this.find({ customer: customer._id, ...filter }).sort({ createdAt: -1 });
};

/**
 * Nets a customer's open balances into a single position.
 * `net > 0` -- the customer owes the shop. `net < 0` -- the shop owes them.
 */
transactionSchema.statics.netBalanceForCustomer = async function (
  customerId: Types.ObjectId | string,
) {
  const open = await this.find({ customer: customerId, status: "open" });

  let customerOwesShop = 0;
  let shopOwesCustomer = 0;

  for (const transaction of open as TransactionDocument[]) {
    if (transaction.type === "sell") customerOwesShop += transaction.remainingAmount;
    else shopOwesCustomer += transaction.remainingAmount;
  }

  return {
    customerOwesShop,
    shopOwesCustomer,
    net: customerOwesShop - shopOwesCustomer,
  };
};

export const TransactionModel = model<Transaction, TransactionModelType>(
  "Transaction",
  transactionSchema,
);
