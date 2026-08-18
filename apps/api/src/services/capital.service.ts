import { Types } from "mongoose";
import { TransactionModel } from "../models/transaction.model.js";
import {
  ShopSettingsModel,
  type ShopSettingsDocument,
  type ShopSettingsInput,
} from "../models/shop-settings.model.js";
import { GoldPriceModel } from "../models/gold-price.model.js";
import { HttpError } from "../middleware/error-handler.js";
import {
  bucketStarts,
  shopDayKey,
  shopDayStart,
  type Granularity,
} from "../lib/shop-calendar.js";

/**
 * CAPITAL, MEASURED IN GRAMS OF GOLD.
 *
 * A gold shop does not think of itself as holding N Toman. It holds a position
 * in gold: the metal in the safe, plus whatever its cash would buy at today's
 * rate, plus what customers owe it, less what it owes them. A shop that opened
 * with 1kg and now has 700g and a pile of cash may be at 1,150g -- and that
 * number, not the Toman one, is the one that says whether the year went well.
 *
 *   goldGrams   = opening - S(sell weight) + S(buy weight)
 *   cash        = opening + S(payments on sells) - S(payments on buys)
 *   receivables = S(remaining on sells)     -- owed TO the shop
 *   payables    = S(remaining on buys)      -- owed BY the shop
 *   capital     = goldGrams + (cash + receivables - payables) / price
 *
 * ---------------------------------------------------------------------------
 * ALWAYS RECOMPUTED FROM SOURCE. NEVER A STORED RUNNING TOTAL.
 * ---------------------------------------------------------------------------
 * The tempting design is a `capitalGrams` field somewhere that every write
 * nudges. It is wrong here, and not by a little: payments are recorded against
 * transactions retroactively -- an instalment carries its own `paidAt`, which
 * can be weeks before the day someone enters it -- so an incremental counter
 * would have to be revised backwards through history it has already published.
 * The first missed revision puts the number quietly out of step with the
 * ledger, and NOTHING DOWNSTREAM CAN DETECT THAT: a wrong total looks exactly
 * like a right one. Recomputing from the transactions on every request cannot
 * drift, because there is no second copy to drift from.
 *
 * The cost of that choice is two aggregation pipelines per request, both of
 * which bucket server-side and return a handful of rows rather than the
 * collection.
 *
 * ---------------------------------------------------------------------------
 * TIME SEMANTICS
 * ---------------------------------------------------------------------------
 * Neither pure flow nor pure stock (contrast stats.service.ts, where the two
 * are kept apart). Each point in this series is a STOCK -- the position as of
 * that instant -- and the series is built by accumulating FLOW deltas into it.
 * Which is why the two clocks below have to be kept straight:
 *
 *   gold and deal totals  move on the transaction's `createdAt`
 *   cash                  moves on the payment's `paidAt`
 *
 * A deal struck in Farvardin and paid in Khordad moves gold in Farvardin and
 * cash in Khordad. Summing payments by their transaction's creation date --
 * the easy mistake, because that is the one date on the parent document --
 * would post the money to the wrong month and make the cash line lie about
 * every period between the two.
 */

/* -------------------------------------------------------------------------- */
/* Opening position                                                           */
/* -------------------------------------------------------------------------- */

export interface ShopSettingsResult {
  configured: boolean;
  settings: ShopSettingsDocument | null;
}

export async function getShopSettings(): Promise<ShopSettingsResult> {
  const settings = await ShopSettingsModel.getSettings();
  return { configured: settings !== null, settings };
}

/**
 * Creates or updates the opening position.
 *
 * Partial on an existing document, complete-or-nothing on the first write:
 * there is no sensible default for "how much gold did you start with", and
 * defaulting any of the three to zero would silently publish a whole history
 * computed from a number nobody entered.
 */
export async function updateShopSettings(
  patch: Partial<ShopSettingsInput>,
): Promise<ShopSettingsDocument> {
  const current = await ShopSettingsModel.getSettings();

  const next = {
    openingGoldGrams: patch.openingGoldGrams ?? current?.openingGoldGrams,
    openingCashToman: patch.openingCashToman ?? current?.openingCashToman,
    openingDate: patch.openingDate ?? current?.openingDate,
  };

  if (
    next.openingGoldGrams === undefined ||
    next.openingCashToman === undefined ||
    next.openingDate === undefined
  ) {
    throw new HttpError(
      400,
      "openingGoldGrams, openingCashToman and openingDate are all required " +
        "the first time the shop is configured",
    );
  }

  return ShopSettingsModel.saveSettings(next as ShopSettingsInput);
}

/* -------------------------------------------------------------------------- */
/* Daily gold price                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Today's price and the most recent one, in a single read for the price form.
 *
 * `today` is what prefills the field and turns "record" into "correct";
 * `latest` is what the screen describes when today's has not been entered yet,
 * so the admin can see the number the figures are currently carried forward
 * from rather than guessing at it.
 */
export async function getPriceContext(at: Date = new Date()) {
  const [today, latest] = await Promise.all([
    GoldPriceModel.forDay(at),
    GoldPriceModel.latestOnOrBefore(at),
  ]);

  return { today, latest };
}

export async function recordGoldPrice(input: {
  date?: Date;
  pricePerGram: number;
  recordedBy: Types.ObjectId | string;
}) {
  return GoldPriceModel.record(input);
}

/* -------------------------------------------------------------------------- */
/* The series                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Ceiling on how many points one response may carry.
 *
 * A five-year custom range at daily granularity is ~1,800 points: more
 * boundaries than `$bucket` wants, more line vertices than a chart can draw
 * legibly, and more rows than anyone reads. Past this the granularity is
 * coarsened a step at a time and the response says which one it actually used,
 * so the client renders what it got instead of what it asked for.
 */
const MAX_POINTS = 370;

const COARSER: Record<Granularity, Granularity | null> = {
  day: "week",
  week: "month",
  month: null,
};

export interface CapitalPoint {
  /** Start of the bucket, as an instant. */
  date: Date;
  /**
   * The same bucket start as a plain `YYYY-MM-DD` on the shop's calendar, and
   * the field a client should LABEL the point with.
   *
   * `date` above is an instant that happens to be midnight in Tehran, so
   * anything formatting it in another timezone lands on the day before or
   * after -- a monthly series rendered from a UTC clock labels every bucket
   * with the last day of the previous month. The day is a calendar fact, not a
   * moment, so it travels as one.
   */
  day: string;
  /** The instant the figures are measured at: the end of the bucket. */
  at: Date;
  capitalGrams: number;
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
  pricePerGram: number;
  /**
   * True when no price was recorded for this point's own day and the most
   * recent earlier one was carried forward. The figure is then an estimate,
   * and the chart marks it as one rather than presenting it as measured.
   */
  estimated: boolean;
}

export interface CapitalSnapshot {
  at: Date;
  /** Null only when no gold price has ever been recorded -- see priceLookup. */
  capitalGrams: number | null;
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
  pricePerGram: number | null;
  estimated: boolean;
  /**
   * Movement since the start of the requested range. Null when the opening
   * capital cannot be valued (no price on or before `from`); `percent` is null
   * on its own when the baseline was zero, which has no percentage.
   */
  change: {
    grams: number;
    percent: number | null;
    fromCapitalGrams: number;
  } | null;
}

export interface CapitalSeriesOptions {
  /** Defaults to the opening date -- the shop's whole history. */
  from?: Date;
  /** Defaults to now. */
  to?: Date;
  granularity: Granularity;
}

export interface CapitalSeriesResult {
  range: { from: Date; to: Date; granularity: Granularity };
  opening: { goldGrams: number; cashToman: number; date: Date };
  series: CapitalPoint[];
  snapshot: CapitalSnapshot;
}

/** What one interval contributes, in the units each figure is measured in. */
interface Deltas {
  sellGrams: number;
  buyGrams: number;
  sellTotal: number;
  buyTotal: number;
  sellPaid: number;
  buyPaid: number;
}

const NO_DELTAS: Deltas = {
  sellGrams: 0,
  buyGrams: 0,
  sellTotal: 0,
  buyTotal: 0,
  sellPaid: 0,
  buyPaid: 0,
};

export async function getCapitalSeries({
  from: requestedFrom,
  to: requestedTo,
  granularity,
}: CapitalSeriesOptions): Promise<CapitalSeriesResult> {
  const settings = await ShopSettingsModel.getSettings();
  if (!settings) {
    // 409 rather than 404: the route exists and the request was well formed,
    // but the shop has no starting position, and capital measured from an
    // unknown opening balance is not a smaller answer -- it is a wrong one.
    throw new HttpError(
      409,
      "Shop settings have not been configured. Set the opening gold, cash and " +
        "date before requesting capital figures.",
    );
  }

  const now = new Date();

  /**
   * Everything before the opening date is assumed to be already counted inside
   * the opening figures -- that is what an opening balance means -- so it is
   * excluded outright rather than added on top, which would count it twice.
   * Both pipelines below take this as their lower bound, transactions and
   * their instalments alike.
   */
  const openingDate = settings.openingDate;

  // Unbounded means "the whole history": from the day the shop opened its
  // books here, to this instant.
  const from = requestedFrom ?? openingDate;
  const to = requestedTo ?? now;

  // A range running past now would plot points into the future, and "this
  // month" must report where the shop stands today, not on the 31st.
  const effectiveTo = new Date(Math.min(to.getTime(), now.getTime()));
  const effectiveGranularity = fitGranularity(from, effectiveTo, granularity);

  const points = buildPoints({
    from,
    to: effectiveTo,
    openingDate,
    granularity: effectiveGranularity,
  });

  /**
   * The instant the range opens, which is where the "change over the period"
   * figure is measured from. It gets a boundary of its own, and that is
   * load-bearing: a bucket CONTAINS the range start rather than beginning at it
   * -- a month range starting on the 5th still belongs to a bucket that opened
   * on the 1st -- so without this cut, the interval carrying the baseline would
   * also carry the first few days of the range and the comparison would be
   * against a position several days into the period it is measuring.
   */
  const baselineAt = new Date(Math.max(from.getTime(), openingDate.getTime()));
  const nowExclusive = new Date(now.getTime() + 1);

  /**
   * Boundaries for both pipelines: the opening date, the baseline cut, the
   * exclusive end of every point's interval, and -- when the range stops short
   * of now -- one more, so the current snapshot accumulates out of the same
   * pass rather than costing two more aggregations.
   *
   * `$bucket` files a document under the greatest boundary not exceeding it, so
   * the group keyed `boundaries[i]` holds exactly the deltas of interval
   * `[boundaries[i], boundaries[i + 1])`, and a running sum over them in order
   * is the stock at each point.
   */
  const boundaries: Date[] = [openingDate];
  /** Boundaries must strictly increase; duplicates are simply not added. */
  const pushBoundary = (at: Date) => {
    if (at.getTime() > boundaries[boundaries.length - 1]!.getTime()) {
      boundaries.push(at);
    }
  };

  pushBoundary(baselineAt);

  /** Which point closes at a given boundary, so the loop can emit it there. */
  const pointAtBoundary = new Map<number, PointWindow>();
  for (const point of points) {
    pushBoundary(point.endExclusive);
    pointAtBoundary.set(point.endExclusive.getTime(), point);
  }

  pushBoundary(nowExclusive);

  const [dealDeltas, paymentDeltas, prices] = await Promise.all([
    aggregateDeals(boundaries),
    aggregatePayments(boundaries),
    listPrices(now),
  ]);

  const priceAt = priceLookup(prices);

  /**
   * One pass over the intervals in order. `running` is the flow accumulated so
   * far, so at the top of iteration `i` it describes the position as of
   * `boundaries[i]` -- which is what makes both the baseline and each point
   * readable off the same walk.
   */
  const running: Deltas = { ...NO_DELTAS };
  const series: CapitalPoint[] = [];
  let baselinePosition: Position | null = null;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    if (boundaries[index]!.getTime() === baselineAt.getTime()) {
      baselinePosition = positionFrom(settings, running);
    }

    const key = boundaries[index]!.getTime();
    accumulate(running, dealDeltas.get(key));
    accumulate(running, paymentDeltas.get(key));

    const point = pointAtBoundary.get(boundaries[index + 1]!.getTime());
    if (!point) continue;

    const price = priceAt(point.at);
    // No price on or before this point at all: there is no honest way to value
    // the cash, so the point is omitted rather than guessed at.
    if (!price) continue;

    const position = positionFrom(settings, running);

    series.push({
      date: point.date,
      day: shopDayKey(point.date),
      at: point.at,
      ...position,
      capitalGrams: valueInGrams(position, price.pricePerGram),
      pricePerGram: price.pricePerGram,
      estimated: price.estimated,
    });
  }

  // The final boundary is `nowExclusive`, so `running` now covers everything up
  // to this instant -- including anything after the end of a historical range.
  const position = positionFrom(settings, running);
  const price = priceAt(now);
  const capitalGrams = price ? valueInGrams(position, price.pricePerGram) : null;

  return {
    range: { from, to: effectiveTo, granularity: effectiveGranularity },
    opening: {
      goldGrams: settings.openingGoldGrams,
      cashToman: settings.openingCashToman,
      date: settings.openingDate,
    },
    series,
    snapshot: {
      at: now,
      ...position,
      capitalGrams,
      pricePerGram: price?.pricePerGram ?? null,
      estimated: price?.estimated ?? false,
      change:
        capitalGrams === null || baselinePosition === null
          ? null
          : changeAgainstRangeStart({
              capitalGrams,
              baselineAt,
              baselinePosition,
              priceAt,
            }),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

/** Coarsens the requested granularity until the range fits inside MAX_POINTS. */
function fitGranularity(
  from: Date,
  to: Date,
  requested: Granularity,
): Granularity {
  let granularity = requested;

  while (bucketStarts(from, to, granularity).length > MAX_POINTS) {
    const coarser = COARSER[granularity];
    // Months are as coarse as it gets. A range long enough to overflow at that
    // granularity is thirty years, which the cap can simply carry.
    if (!coarser) return granularity;
    granularity = coarser;
  }

  return granularity;
}

interface PointWindow {
  /** Bucket start -- the label the client plots against. */
  date: Date;
  /** Last instant the point covers; the figures are measured here. */
  at: Date;
  /** One millisecond past `at`, which is the aggregation boundary. */
  endExclusive: Date;
}

function buildPoints({
  from,
  to,
  openingDate,
  granularity,
}: {
  from: Date;
  to: Date;
  openingDate: Date;
  granularity: Granularity;
}): PointWindow[] {
  const starts = bucketStarts(from, to, granularity);
  const windows: PointWindow[] = [];

  for (const [index, start] of starts.entries()) {
    const nextStart = starts[index + 1];
    // The final bucket is cut short at the end of the range rather than run to
    // its natural end.
    const at = new Date(
      Math.min(nextStart ? nextStart.getTime() - 1 : to.getTime(), to.getTime()),
    );

    // Nothing to say about a point that predates the opening position: every
    // figure would be the opening one, drawn as a flat line the shop never had.
    if (at.getTime() < openingDate.getTime()) continue;

    windows.push({ date: start, at, endExclusive: new Date(at.getTime() + 1) });
  }

  return windows;
}

/**
 * Gold weight and deal value per interval, on the transaction's `createdAt`.
 *
 * ---------------------------------------------------------------------------
 * ALL GOLD IS TREATED AS FUNGIBLE BY WEIGHT. A DELIBERATE SIMPLIFICATION.
 *
 * `goldType` distinguishes melted, new and second-hand gold, and they are not
 * really interchangeable: they differ in purity -- a gram of a new 18k piece is
 * not a gram of scrap -- and in the making fee (اجرت) baked into the price. So
 * a gram bought in as scrap and a gram sold as a new piece are different assets
 * that this `$sum` adds together as though they were one.
 *
 * That is how the shop states the headline figure itself ("how many grams am I
 * worth", asked of the counter as a whole), and doing it properly needs a
 * purity factor per gold type and a making-fee split on every deal, neither of
 * which this schema records. If those are ever added, this sum and the opening
 * balance in shop-settings are the two places the weighting belongs.
 * ---------------------------------------------------------------------------
 */
async function aggregateDeals(boundaries: Date[]): Promise<Map<number, Deltas>> {
  const rows = await TransactionModel.aggregate<{ _id: unknown } & Deltas>([
    {
      $match: {
        createdAt: {
          $gte: boundaries[0]!,
          $lt: boundaries[boundaries.length - 1]!,
        },
      },
    },
    {
      $bucket: {
        groupBy: "$createdAt",
        boundaries,
        // Unreachable after the $match above. Present so that a boundary bug
        // degrades into one ignored group instead of killing the pipeline --
        // `$bucket` errors outright on a value it cannot place.
        default: "outside",
        output: {
          sellGrams: sumWhen("sell", "$goldWeightGrams"),
          buyGrams: sumWhen("buy", "$goldWeightGrams"),
          sellTotal: sumWhen("sell", "$totalAmount"),
          buyTotal: sumWhen("buy", "$totalAmount"),
        },
      },
    },
  ]);

  return toDeltaMap(rows);
}

/**
 * Instalments per interval, on the PAYMENT's `paidAt` -- not on the parent
 * transaction's creation date. See the note at the top of the file: this is the
 * whole reason cash is aggregated separately from the deal that produced it.
 */
async function aggregatePayments(
  boundaries: Date[],
): Promise<Map<number, Deltas>> {
  const lower = boundaries[0]!;
  const upper = boundaries[boundaries.length - 1]!;

  const rows = await TransactionModel.aggregate<{ _id: unknown } & Deltas>([
    {
      // Narrows on the parent before unwinding, so a transaction with no
      // instalment in range never has its array expanded. `createdAt` is
      // bounded for the same reason as in aggregateDeals: a pre-opening deal is
      // already inside the opening balance, and so are its instalments.
      $match: {
        createdAt: { $gte: lower, $lt: upper },
        payments: { $elemMatch: { paidAt: { $gte: lower, $lt: upper } } },
      },
    },
    { $unwind: "$payments" },
    // Again after the unwind: the filter above admits the whole document on the
    // strength of one qualifying instalment, its siblings included.
    { $match: { "payments.paidAt": { $gte: lower, $lt: upper } } },
    {
      $bucket: {
        groupBy: "$payments.paidAt",
        boundaries,
        default: "outside",
        output: {
          sellPaid: sumWhen("sell", "$payments.amount"),
          buyPaid: sumWhen("buy", "$payments.amount"),
        },
      },
    },
  ]);

  return toDeltaMap(rows);
}

/** `$sum` of `field`, counting only transactions of one direction. */
function sumWhen(type: "sell" | "buy", field: string) {
  return { $sum: { $cond: [{ $eq: ["$type", type] }, field, 0] } };
}

/** Keys the pipeline's groups by boundary timestamp, dropping any `default`. */
function toDeltaMap(
  rows: ({ _id: unknown } & Partial<Deltas>)[],
): Map<number, Deltas> {
  const map = new Map<number, Deltas>();

  for (const row of rows) {
    // The `default` group's _id is the string "outside"; a real bucket's is the
    // boundary Date.
    if (!(row._id instanceof Date)) continue;
    map.set(row._id.getTime(), { ...NO_DELTAS, ...row });
  }

  return map;
}

function accumulate(running: Deltas, deltas: Deltas | undefined): void {
  if (!deltas) return;
  running.sellGrams += deltas.sellGrams;
  running.buyGrams += deltas.buyGrams;
  running.sellTotal += deltas.sellTotal;
  running.buyTotal += deltas.buyTotal;
  running.sellPaid += deltas.sellPaid;
  running.buyPaid += deltas.buyPaid;
}

interface Position {
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
}

/** The stock position implied by a set of accumulated deltas. */
function positionFrom(settings: ShopSettingsDocument, running: Deltas): Position {
  /**
   * Receivables and payables are `S totals - S payments`, per side.
   *
   * That is the same figure as summing each transaction's `remainingAmount`,
   * because the model refuses an overpayment -- so no single remainder can go
   * negative and be netted off by another's surplus. Expressing it as two
   * running sums is what makes it computable AS OF A PAST INSTANT: a
   * per-document remainder can only ever be read as of now, since it reflects
   * every payment currently on the document whenever it was made.
   *
   * Settled transactions are not excluded, and must not be. One settled this
   * morning was still outstanding last month, and dropping it would erase a
   * receivable the shop really had at the point being plotted; once its
   * payments catch up with its total it contributes exactly zero on its own.
   *
   * Clamped at zero for the half-Toman that the model's settlement tolerance
   * lets a final instalment overshoot by.
   */
  return {
    goldGrams: round(
      settings.openingGoldGrams - running.sellGrams + running.buyGrams,
      3,
    ),
    cash: round(settings.openingCashToman + running.sellPaid - running.buyPaid, 2),
    receivables: round(Math.max(0, running.sellTotal - running.sellPaid), 2),
    payables: round(Math.max(0, running.buyTotal - running.buyPaid), 2),
  };
}

/** The whole position expressed in grams, at one price. */
function valueInGrams(position: Position, pricePerGram: number): number {
  // The price is `min: 0` on the model and a division by zero would produce
  // Infinity in the response rather than an error anyone would notice.
  if (pricePerGram <= 0) return round(position.goldGrams, 3);

  return round(
    position.goldGrams +
      (position.cash + position.receivables - position.payables) / pricePerGram,
    3,
  );
}

/** Every price ever recorded up to today, oldest first. One row per trading day. */
async function listPrices(now: Date): Promise<{ date: Date; pricePerGram: number }[]> {
  const rows = await GoldPriceModel.aggregate<{
    date: Date;
    pricePerGram: number;
  }>([
    { $match: { date: { $lte: shopDayStart(now) } } },
    { $sort: { date: 1 } },
    { $project: { _id: 0, date: 1, pricePerGram: 1 } },
  ]);

  return rows;
}

/**
 * A price for any instant, carrying the last recorded one forward.
 *
 * Comparison is between normalised day starts on both sides -- which is exactly
 * what the model stores -- so "was this day's price actually recorded" is an
 * equality test rather than a window, and `estimated` says so without a second
 * query.
 */
function priceLookup(prices: { date: Date; pricePerGram: number }[]) {
  return (at: Date): { pricePerGram: number; estimated: boolean } | null => {
    const day = shopDayStart(at).getTime();

    let found: { date: Date; pricePerGram: number } | null = null;
    for (const price of prices) {
      if (price.date.getTime() > day) break;
      found = price;
    }

    if (!found) return null;

    return {
      pricePerGram: found.pricePerGram,
      estimated: found.date.getTime() !== day,
    };
  };
}

/**
 * Growth over the selected range: where the shop stands now against where it
 * stood when the range opened.
 *
 * The baseline is the position at `from` -- before anything inside the range
 * happened -- valued at the price in force THEN, not today's. Valuing both ends
 * at today's rate would cancel the price movement out and report only the
 * change in metal, which is precisely the growth this screen exists to show.
 */
function changeAgainstRangeStart({
  capitalGrams,
  baselineAt,
  baselinePosition,
  priceAt,
}: {
  capitalGrams: number;
  baselineAt: Date;
  baselinePosition: Position;
  priceAt: (at: Date) => { pricePerGram: number; estimated: boolean } | null;
}): CapitalSnapshot["change"] {
  const price = priceAt(baselineAt);
  if (!price) return null;

  const fromCapitalGrams = valueInGrams(baselinePosition, price.pricePerGram);

  return {
    grams: round(capitalGrams - fromCapitalGrams, 3),
    // A percentage of nothing is not zero, it is undefined -- and rendering an
    // infinite growth rate against an empty opening position is worse than
    // saying there is no figure.
    percent:
      fromCapitalGrams === 0
        ? null
        : round(((capitalGrams - fromCapitalGrams) / fromCapitalGrams) * 100, 2),
    fromCapitalGrams,
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
