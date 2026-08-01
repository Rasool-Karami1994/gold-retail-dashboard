import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    instructor: { type: String, required: true, trim: true },
    /** Toman, stored as an integer to avoid float rounding on money. */
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    isFree: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
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

/** Price after discount, in Toman. */
courseSchema.virtual("finalPrice").get(function () {
  if (this.isFree) return 0;
  return Math.round(this.price * (1 - (this.discountPercent ?? 0) / 100));
});

export type Course = InferSchemaType<typeof courseSchema>;
export type CourseDocument = HydratedDocument<Course>;

export const CourseModel = model("Course", courseSchema);
