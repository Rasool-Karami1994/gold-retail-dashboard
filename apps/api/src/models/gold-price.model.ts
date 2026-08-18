import {
  Schema,
  Types,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { shopDayStart } from "../lib/shop-calendar.js";

/**
 * The shop's quoted gold price for one day, in Toman per gram.
 *
 * This is what makes a capital figure comparable over time: cash is only worth
 * a number of grams at some price, and the price that mattered on a past day is
 * the one recorded on that day -- not today's. Valuing last spring's cash at
 * today's rate would show growth the shop never had.
 *
 * ONE ROW PER DAY, enforced by a unique index on `date`. `date` is always
 * normalised to the start of the shop's Tehran day (see shop-calendar.ts), so
 * two submissions on the same afternoon land on the same key and the second
 * CORRECTS the first rather than adding a duplicate the reports would then have
 * to choose between.
 *
 * Distinct from `Transaction.dailyGoldPricePerGram`, which is the rate one deal
 * was struck at and stays frozen on that invoice forever. This is the shop's
 * daily mark, and it exists for days on which nothing was traded at all.
 */

const goldPriceSchema = new Schema(
  {
    /** Start of the Tehran day this price is for. Normalised on write. */
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

    /** Which staff member submitted it, for an audit trail. */
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

// `date` is already indexed by `unique: true`. That index also serves the
// carry-forward lookup ("latest price on or before X"), which is a descending
// scan of one key.

export type GoldPrice = InferSchemaType<typeof goldPriceSchema>;
export type GoldPriceDocument = HydratedDocument<GoldPrice>;

export interface GoldPriceModelType extends Model<GoldPrice> {
  /** Records or corrects the price for the day containing `date`. */
  record(input: {
    date?: Date;
    pricePerGram: number;
    recordedBy: Types.ObjectId | string;
  }): Promise<GoldPriceDocument>;

  /** The price for the day containing `at`, or null if none was recorded. */
  forDay(at: Date): Promise<GoldPriceDocument | null>;

  /** The most recent price recorded on or before `at`. */
  latestOnOrBefore(at: Date): Promise<GoldPriceDocument | null>;
}

goldPriceSchema.statics.record = function (input: {
  date?: Date;
  pricePerGram: number;
  recordedBy: Types.ObjectId | string;
}) {
  const day = shopDayStart(input.date ?? new Date());

  // Upsert on the normalised day, so re-entering today's price corrects it.
  // `recordedBy` is overwritten too: whoever last touched the number is the
  // person to ask about it.
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
