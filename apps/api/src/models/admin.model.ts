import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";

/**
 * Shop staff. Admins are the only accounts with a password -- they sign in with
 * username + password, unlike customers, who authenticate by OTP only
 * (see customer.model.ts and otp-request.model.ts).
 *
 * An Admin is the actor on the other side of every Transaction: the shop. A
 * transaction's `createdBy` records which staff member rang it up, which is what
 * makes the debt/credit direction attributable during an end-of-day reconcile.
 */

export const ADMIN_ROLES = ["admin", "superadmin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const adminSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40,
    },

    // Never a plaintext password. Hash with argon2/bcrypt in the auth service
    // before assigning. `select: false` keeps it out of ordinary reads -- you
    // have to ask for it explicitly: `.select("+passwordHash")`.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ADMIN_ROLES,
      default: "admin",
      index: true,
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
        // Belt and braces: even if someone explicitly selected it, it must not
        // leave the process in a response body.
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export type Admin = InferSchemaType<typeof adminSchema>;
export type AdminDocument = HydratedDocument<Admin>;

export const AdminModel = model("Admin", adminSchema);
