import { Schema, model } from "mongoose";

/**
 * Atomic sequence counters, keyed by an arbitrary string.
 *
 * Exists to make `Transaction.invoiceNumber` collision-free. The obvious
 * alternative -- `countDocuments()` for today and add one -- races: two
 * cashiers ringing up sales in the same second both read N and both write
 * N+1, and one insert dies on the unique index. `$inc` with `upsert` is a
 * single atomic document update, so each caller gets a distinct number.
 */

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = model("Counter", counterSchema);

/** Increments the counter for `key` and returns the new value (1 on first use). */
export async function nextSequence(key: string): Promise<number> {
  const counter = await CounterModel.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, lean: true },
  );

  return counter?.seq ?? 1;
}
