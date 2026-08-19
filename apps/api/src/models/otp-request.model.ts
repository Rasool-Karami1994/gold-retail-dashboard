import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { MOBILE_PATTERN, normalizeMobile } from "../lib/mobile.js";

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

    verifiedAt: {
      type: Date,
      default: null,
    },

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

otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

otpRequestSchema.index({ mobile: 1, purpose: 1, createdAt: -1 });

otpRequestSchema.index({ mobile: 1, purpose: 1, verified: 1, verifiedAt: -1 });

otpRequestSchema.index({ mobile: 1, createdAt: -1 });

otpRequestSchema.virtual("isUsable").get(function () {
  return !this.verified && this.expiresAt.getTime() > Date.now();
});

export type OtpRequest = InferSchemaType<typeof otpRequestSchema>;
export type OtpRequestDocument = HydratedDocument<
  OtpRequest,
  { isUsable: boolean }
>;

export const OtpRequestModel = model("OtpRequest", otpRequestSchema);
