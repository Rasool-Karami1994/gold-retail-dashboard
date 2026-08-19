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

export const TRANSACTION_TYPES = ["sell", "buy"] as const;
export const GOLD_TYPES = ["melted", "new", "second-hand"] as const;
export const PAYMENT_METHODS = ["cash", "bank"] as const;
export const BANK_TYPES = ["paya", "card-to-card", "bridge", "satna"] as const;
export const TRANSACTION_STATUSES = ["open", "settled"] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type GoldType = (typeof GOLD_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type BankType = (typeof BANK_TYPES)[number];
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

const SETTLEMENT_TOLERANCE = 0.5;

const INVOICE_TIMEZONE = "Asia/Tehran";

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

    bankType: {
      type: String,
      enum: BANK_TYPES,
      required: function (this: { method?: PaymentMethod }) {
        return this.method === "bank";
      },
    },

    destinationCard: {
      type: String,
      trim: true,
      match: [/^\d{16}$/, "Destination card must be 16 digits"],
    },

    destinationIban: {
      type: String,
      trim: true,
      uppercase: true,
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

    dailyGoldPricePerGram: {
      type: Number,
      required: true,
      min: [0, "Price per gram cannot be negative"],
    },

    profitPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Profit percentage cannot be negative"],
      max: [100, "Profit percentage cannot exceed 100"],
    },

    profitAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Profit amount cannot be negative"],
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: "open",
    },

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

transactionSchema.virtual("paidAmount").get(function () {
  return (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
});

transactionSchema.virtual("remainingAmount").get(function () {
  const paid = (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
  return Math.max(0, Math.round((this.totalAmount - paid) * 100) / 100);
});

transactionSchema.virtual("balanceDirection").get(function () {
  const paid = (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
  const remaining = this.totalAmount - paid;

  if (remaining <= SETTLEMENT_TOLERANCE) return "none";
  return this.type === "sell" ? "customer-owes-shop" : "shop-owes-customer";
});

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
  if (
    this.isNew ||
    this.isModified("goldWeightGrams") ||
    this.isModified("dailyGoldPricePerGram") ||
    this.isModified("profitPercentage") ||
    this.isModified("type")
  ) {
    const baseAmount = Math.round(
      this.goldWeightGrams * this.dailyGoldPricePerGram,
    );
    const profit = Math.round(baseAmount * ((this.profitPercentage ?? 0) / 100));

    this.profitAmount = profit;
    this.totalAmount =
      this.type === "buy" ? baseAmount - profit : baseAmount + profit;
  }

  const paid = (this.payments ?? []).reduce(
    (sum, payment) => sum + (payment.amount ?? 0),
    0,
  );
  this.status =
    this.totalAmount - paid <= SETTLEMENT_TOLERANCE ? "settled" : "open";

  if (this.isNew && !this.invoiceNumber) {
    this.invoiceNumber = await generateInvoiceNumber();
  }

  next();
});

async function generateInvoiceNumber(when = new Date()): Promise<string> {
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

transactionSchema.index({ customer: 1, createdAt: -1 });

transactionSchema.index({ customer: 1, status: 1, type: 1 });

transactionSchema.index({ createdAt: -1 });

transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1, createdAt: -1 });

transactionSchema.index({ createdBy: 1, createdAt: -1 });

transactionSchema.index({ goldType: 1, createdAt: -1 });

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

export interface TransactionMethods {}

export type TransactionDocument = HydratedDocument<
  Transaction,
  TransactionMethods & TransactionVirtuals
>;

export interface TransactionModelType
  extends Model<Transaction, {}, TransactionMethods, TransactionVirtuals> {
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

transactionSchema.statics.addPayment = async function (
  id: string,
  input: AddPaymentInput,
): Promise<AddPaymentOutcome> {
  const self = TransactionModel;
  if (!Types.ObjectId.isValid(id)) return { ok: false, reason: "not-found" };

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

  const remainingExpr = {
    $subtract: ["$totalAmount", { $sum: "$payments.amount" }],
  };

  const updated = await self.findOneAndUpdate(
    {
      _id: new Types.ObjectId(id),
      status: "open",
      $expr: {
        $lte: [input.amount, { $add: [remainingExpr, SETTLEMENT_TOLERANCE] }],
      },
    },
    [
      { $set: { payments: { $concatArrays: ["$payments", [payment]] } } },
      {
        $set: {
          status: {
            $cond: [
              { $lte: [remainingExpr, SETTLEMENT_TOLERANCE] },
              "settled",
              "open",
            ],
          },
          updatedAt: "$$NOW",
        },
      },
    ],
    { new: true },
  );

  if (updated) return { ok: true, transaction: updated };

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
  const customer = await CustomerModel.findOne({
    mobile: normalizeMobile(mobile),
  })
    .select("_id")
    .lean();

  if (!customer) return [];

  return this.find({ customer: customer._id, ...filter }).sort({ createdAt: -1 });
};

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
