import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * The shop's opening position: how much gold and how much cash it held when it
 * started keeping books here.
 *
 * A SINGLETON. Capital is measured against a starting point, and two starting
 * points would produce two different histories with nothing to say which is
 * the shop's. The `_id` is therefore a fixed string rather than an ObjectId --
 * the primary key's own unique index is what makes a second document
 * impossible, which no application-level check can promise under concurrency.
 *
 * `openingDate` is not decoration. It is the boundary of the whole capital
 * calculation: everything before it is assumed to be already counted inside
 * `openingGoldGrams` and `openingCashToman`, so the aggregation ignores
 * transactions dated earlier. Moving it therefore rewrites every historical
 * figure -- which is why the UI warns before changing it.
 */

export const SHOP_SETTINGS_ID = "shop-settings";

const shopSettingsSchema = new Schema(
  {
    _id: { type: String, default: SHOP_SETTINGS_ID },

    /** Physical gold on hand at `openingDate`, in grams. */
    openingGoldGrams: {
      type: Number,
      required: true,
      min: [0, "Opening gold cannot be negative"],
    },

    /** Cash on hand at `openingDate`, in Toman. */
    openingCashToman: {
      type: Number,
      required: true,
      min: [0, "Opening cash cannot be negative"],
    },

    /** The instant the opening figures describe. See the note above. */
    openingDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    // The `_id` is a constant the client has no use for; `configured` in the
    // service response is what tells it whether this document exists.
    toJSON: {
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret._id;
        return ret;
      },
    },
  },
);

export type ShopSettings = InferSchemaType<typeof shopSettingsSchema>;
export type ShopSettingsDocument = HydratedDocument<ShopSettings>;

export interface ShopSettingsInput {
  openingGoldGrams: number;
  openingCashToman: number;
  openingDate: Date;
}

export interface ShopSettingsModelType extends Model<ShopSettings> {
  /** The singleton, or null when the shop has never been configured. */
  getSettings(): Promise<ShopSettingsDocument | null>;
  /** Creates or replaces the singleton. */
  saveSettings(input: ShopSettingsInput): Promise<ShopSettingsDocument>;
}

shopSettingsSchema.statics.getSettings = function () {
  return this.findById(SHOP_SETTINGS_ID).exec();
};

shopSettingsSchema.statics.saveSettings = function (input: ShopSettingsInput) {
  // Upsert on the fixed id: first write creates, every later one replaces the
  // same document. `runValidators` because a query update skips the schema's
  // validators otherwise, and a negative opening balance would slip through.
  return this.findByIdAndUpdate(
    SHOP_SETTINGS_ID,
    { $set: input },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
};

export const ShopSettingsModel = model<ShopSettings, ShopSettingsModelType>(
  "ShopSettings",
  shopSettingsSchema,
);
