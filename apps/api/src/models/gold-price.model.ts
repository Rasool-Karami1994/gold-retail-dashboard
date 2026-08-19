import {
  Schema,
  Types,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { shopDayStart } from "../lib/shop-calendar.js";

const goldPriceSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
    },

    pricePerGram: {
      type: Number,
      required: true,
      min: [0, "Price per gram cannot be negative"],
    },

    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

export type GoldPrice = InferSchemaType<typeof goldPriceSchema>;
export type GoldPriceDocument = HydratedDocument<GoldPrice>;

export interface GoldPriceModelType extends Model<GoldPrice> {
  record(input: {
    date?: Date;
    pricePerGram: number;
    recordedBy: Types.ObjectId | string;
  }): Promise<GoldPriceDocument>;

  forDay(at: Date): Promise<GoldPriceDocument | null>;

  latestOnOrBefore(at: Date): Promise<GoldPriceDocument | null>;
}

goldPriceSchema.statics.record = function (input: {
  date?: Date;
  pricePerGram: number;
  recordedBy: Types.ObjectId | string;
}) {
  const day = shopDayStart(input.date ?? new Date());

  return this.findOneAndUpdate(
    { date: day },
    {
      $set: {
        pricePerGram: input.pricePerGram,
        recordedBy: new Types.ObjectId(String(input.recordedBy)),
      },
      $setOnInsert: { date: day },
    },
    { new: true, upsert: true, runValidators: true },
  ).exec();
};

goldPriceSchema.statics.forDay = function (at: Date) {
  return this.findOne({ date: shopDayStart(at) }).exec();
};

goldPriceSchema.statics.latestOnOrBefore = function (at: Date) {
  return this.findOne({ date: { $lte: shopDayStart(at) } })
    .sort({ date: -1 })
    .exec();
};

export const GoldPriceModel = model<GoldPrice, GoldPriceModelType>(
  "GoldPrice",
  goldPriceSchema,
);
