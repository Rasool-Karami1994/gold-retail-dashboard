import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const SHOP_SETTINGS_ID = "shop-settings";

const shopSettingsSchema = new Schema(
  {
    _id: { type: String, default: SHOP_SETTINGS_ID },

    openingGoldGrams: {
      type: Number,
      required: true,
      min: [0, "Opening gold cannot be negative"],
    },

    openingCashToman: {
      type: Number,
      required: true,
      min: [0, "Opening cash cannot be negative"],
    },

    openingDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
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
  getSettings(): Promise<ShopSettingsDocument | null>;
  saveSettings(input: ShopSettingsInput): Promise<ShopSettingsDocument>;
}

shopSettingsSchema.statics.getSettings = function () {
  return this.findById(SHOP_SETTINGS_ID).exec();
};

shopSettingsSchema.statics.saveSettings = function (input: ShopSettingsInput) {
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
