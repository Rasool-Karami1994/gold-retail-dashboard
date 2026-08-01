import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { MOBILE_PATTERN, normalizeMobile } from "../lib/mobile.js";

/**
 * A shop customer. Deliberately has **no password field** -- customers prove
 * ownership of their mobile number via OTP (see otp-request.model.ts), and the
 * mobile number is the account identity. That is why `mobile` is unique and
 * indexed: it is the login handle, not just contact information.
 *
 * Debt/credit: a customer's balance is not stored here. It is the sum of
 * `remainingAmount` across their Transactions, and its meaning depends on each
 * transaction's `type` -- on a 'sell' the customer owes the shop, on a 'buy' the
 * shop owes the customer. See transaction.model.ts for the full rule; keeping a
 * denormalised balance on this document would go stale the moment a payment is
 * recorded.
 */

const customerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Normalise on the way in so `+98912…` and `0912…` collide on the unique
      // index instead of creating two accounts for one person.
      set: normalizeMobile,
      match: [MOBILE_PATTERN, "Mobile must be a valid Iranian number (09XXXXXXXXX)"],
    },
  },
  {
    // Provides createdAt / updatedAt.
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
  },
);

customerSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Name search for the customer picker on the transaction form.
customerSchema.index({ lastName: 1, firstName: 1 });
customerSchema.index({ createdAt: -1 });

export type Customer = InferSchemaType<typeof customerSchema>;
export type CustomerDocument = HydratedDocument<Customer, { fullName: string }>;

export const CustomerModel = model("Customer", customerSchema);
