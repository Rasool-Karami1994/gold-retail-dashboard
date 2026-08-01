import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { MOBILE_PATTERN, normalizeMobile } from "../lib/mobile.js";

/**
 * One-time codes for customer authentication. Customers have no password, so
 * this collection *is* the customer credential store: possession of the mobile
 * number is the proof of identity.
 *
 * Two purposes share the schema:
 *   - 'register' -- no Customer exists for this mobile yet; verifying creates one
 *   - 'login'    -- a Customer exists; verifying issues a session
 *
 * Debt/credit: none directly. It matters only in that a verified OTP is what
 * lets a customer see their own Transactions, and therefore the balances the
 * shop is holding for or against them.
 *
 * Records expire on their own -- see the TTL index below.
 */

export const OTP_PURPOSES = ["login", "register"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

const otpRequestSchema = new Schema(
  {
    mobile: {
      type: String,
      required: true,
      trim: true,
      set: normalizeMobile,
      match: [MOBILE_PATTERN, "Mobile must be a valid Iranian number (09XXXXXXXXX)"],
    },

    // NOTE: stored as issued, per spec. `select: false` keeps it out of ordinary
    // reads, but anyone with database access can still read live codes. If you
    // want that closed, hash this the way `Admin.passwordHash` is hashed and
    // compare on verify -- the field name and everything else here stays put.
    code: {
      type: String,
      required: true,
      select: false,
    },

    purpose: {
      type: String,
      enum: OTP_PURPOSES,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    // Lets the verify endpoint lock out brute force without a separate store.
    attempts: {
      type: Number,
      default: 0,
      min: 0,
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
        delete ret.code;
        return ret;
      },
    },
  },
);

/**
 * TTL index: MongoDB deletes each document once `expiresAt` passes, so expired
 * codes clean themselves up and the collection stays small.
 *
 * Two things to know about it:
 *   1. The TTL monitor runs about once a minute, so a document can outlive
 *      `expiresAt` by up to ~60s. Never treat "the document still exists" as
 *      "the code is still valid" -- always compare `expiresAt` to now in the
 *      verify path as well.
 *   2. `expireAfterSeconds: 0` means "expire at the time in the field", not
 *      "expire immediately".
 */
otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// The verify path: newest unverified code for this mobile and purpose.
otpRequestSchema.index({ mobile: 1, purpose: 1, createdAt: -1 });

// Rate limiting: how many codes has this number asked for recently?
otpRequestSchema.index({ mobile: 1, createdAt: -1 });

/** True when the code is still usable: not yet verified and not yet expired. */
otpRequestSchema.virtual("isUsable").get(function () {
  return !this.verified && this.expiresAt.getTime() > Date.now();
});

export type OtpRequest = InferSchemaType<typeof otpRequestSchema>;
export type OtpRequestDocument = HydratedDocument<
  OtpRequest,
  { isUsable: boolean }
>;

export const OtpRequestModel = model("OtpRequest", otpRequestSchema);
