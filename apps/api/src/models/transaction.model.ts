import {
  Schema,
  Types,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
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

export interface AddPaymentInput {
  method: PaymentMethod;
  amount: number;
  bankType?: BankType;
  destinationCard?: string;
  destinationIban?: string;
  paidAt?: Date;
}

/**
 * Why the instalment was or was not recorded.
 *
 * A result rather than an exception because two of the three failures are
 * ordinary answers the API has to phrase differently -- 409 for an invoice that
 * is already settled, 400 carrying the balance for one that would be overpaid.
 */
export type AddPaymentOutcome =
  | { ok: true; transaction: TransactionDocument }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "settled"; transaction: TransactionDocument }
  | {
      ok: false;
      reason: "exceeds-remaining";
      remainingAmount: number;
      transaction: TransactionDocument;
    };

/** No document methods. `addPayment` is a static -- see the note on it. */
export interface TransactionMethods {}

export type TransactionDocument = HydratedDocument<
  Transaction,
  TransactionMethods & TransactionVirtuals
>;

export interface TransactionModelType
  extends Model<Transaction, {}, TransactionMethods, TransactionVirtuals> {
  /**
   * The ONLY supported way to record an instalment. Atomic, and it re-derives
   * `status` itself -- see the note on the implementation for why a
   * load-mutate-save was not good enough.
   */
  addPayment(id: string, input: AddPaymentInput): Promise<AddPaymentOutcome>;

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
 * Records an instalment and re-derives `status`, in ONE database operation.
 *
 * WHY THIS IS NOT A LOAD-MUTATE-SAVE. It used to be, and that read-then-write
 * had a race that money cares about. Two payments arriving together each loaded
 * the document, each saw the same `payments`, and each computed `status` from
 * its own view. Mongoose sends the array change as `$push`, so both instalments
 * survived -- but `status` went out as a plain `$set` from whichever request
 * finished last. Two payments of 50 against a total of 100 left the invoice
 * fully paid and still marked `open`, and no later read would notice.
 *
 * So the guard and the recomputation are expressed as the update itself:
 *
 *   - the filter admits only an `open` transaction whose remaining balance
 *     covers the amount, so a settled invoice and an overpayment are rejected
 *     by not matching rather than by a check that can go stale between the read
 *     and the write;
 *   - the pipeline appends the instalment and then re-derives `status` from
 *     the array it just produced, inside the same operation.
 *
 * THE PRE-VALIDATE HOOK DOES NOT RUN HERE, which is exactly the hazard the note
 * on the model warns about -- a query update that leaves `status` stale. It is
 * safe only because the pipeline below recomputes `status` itself. If you add a
 * field the hook derives, derive it here too or the warning becomes true again.
 *
 * Returns an outcome rather than throwing, because "already settled" and
 * "exceeds the balance" are answers the caller has to turn into different HTTP
 * statuses, and one of them carries the remaining amount.
 */
// Uses TransactionModel rather than `this`: Mongoose types a static's `this` as
// the base Model, which loses the return types this function depends on. The
// model is defined at the bottom of the file and exists long before any caller.
transactionSchema.statics.addPayment = async function (
  id: string,
  input: AddPaymentInput,
): Promise<AddPaymentOutcome> {
  const self = TransactionModel;
  if (!Types.ObjectId.isValid(id)) return { ok: false, reason: "not-found" };

  // Built here rather than trusting the caller's object wholesale: the
  // subdocument's own pre-validate hook -- which strips bank fields off a cash
  // row -- does not run for a pipeline update either.
  const payment = {
    _id: new Types.ObjectId(),
    method: input.method,
    amount: input.amount,
    paidAt: input.paidAt ?? new Date(),
    ...(input.method === "bank"
      ? {
          ...(input.bankType ? { bankType: input.bankType } : {}),
          ...(input.destinationCard
            ? { destinationCard: input.destinationCard }
            : {}),
          ...(input.destinationIban
            ? { destinationIban: input.destinationIban }
            : {}),
        }
      : {}),
  };

  /** Total minus everything paid so far, as an aggregation expression. */
  const remainingExpr = {
    $subtract: ["$totalAmount", { $sum: "$payments.amount" }],
  };

  const updated = await self.findOneAndUpdate(
    {
      _id: new Types.ObjectId(id),
      status: "open",
      // The same tolerance settlement uses. A UI that offers "pay the rest"
      // can compute a figure a fraction of a Toman over the balance, and
      // refusing that would be arithmetic pedantry rather than a guard.
      $expr: {
        $lte: [input.amount, { $add: [remainingExpr, SETTLEMENT_TOLERANCE] }],
      },
    },
    [
      { $set: { payments: { $concatArrays: ["$payments", [payment]] } } },
      {
        // Reads the array the stage above just wrote, so the new instalment is
        // counted. This is the pre-validate hook's rule, expressed in Mongo.
        $set: {
          status: {
            $cond: [
              { $lte: [remainingExpr, SETTLEMENT_TOLERANCE] },
              "settled",
              "open",
            ],
          },
          // Set explicitly rather than relying on Mongoose's timestamps with a
          // pipeline update, which is not a behaviour worth assuming.
          updatedAt: "$$NOW",
        },
      },
    ],
    { new: true },
  );

  if (updated) return { ok: true, transaction: updated };

  // Nothing matched. Re-read to say WHY, so the caller can answer 404, 409 or
  // 400 rather than a single unhelpful failure.
  const current = await self.findById(id);
  if (!current) return { ok: false, reason: "not-found" };
  if (current.status === "settled") {
    return { ok: false, reason: "settled", transaction: current };
  }
  return {
    ok: false,
    reason: "exceeds-remaining",
    remainingAmount: current.remainingAmount,
    transaction: current,
  };
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
