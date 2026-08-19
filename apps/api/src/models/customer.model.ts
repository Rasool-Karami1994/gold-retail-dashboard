import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { MOBILE_PATTERN, normalizeMobile } from "../lib/mobile.js";

const customerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      set: normalizeMobile,
      match: [MOBILE_PATTERN, "Mobile must be a valid Iranian number (09XXXXXXXXX)"],
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
  },
);

customerSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

customerSchema.index({ lastName: 1, firstName: 1 });
customerSchema.index({ createdAt: -1 });

export type Customer = InferSchemaType<typeof customerSchema>;
export type CustomerDocument = HydratedDocument<Customer, { fullName: string }>;

export const CustomerModel = model("Customer", customerSchema);
