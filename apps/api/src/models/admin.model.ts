import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";

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
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export type Admin = InferSchemaType<typeof adminSchema>;
export type AdminDocument = HydratedDocument<Admin>;

export const AdminModel = model("Admin", adminSchema);
