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

export interface ShopSettingsResult {
  configured: boolean;
  settings: ShopSettingsDocument | null;
}

export async function getShopSettings(): Promise<ShopSettingsResult> {
  const settings = await ShopSettingsModel.getSettings();
  return { configured: settings !== null, settings };
}

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

const MAX_POINTS = 370;

const COARSER: Record<Granularity, Granularity | null> = {
  day: "week",
  week: "month",
  month: null,
};

export interface CapitalPoint {
  date: Date;
  day: string;
  at: Date;
  capitalGrams: number;
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
  pricePerGram: number;
  estimated: boolean;
}

export interface CapitalSnapshot {
  at: Date;
  capitalGrams: number | null;
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
  pricePerGram: number | null;
  estimated: boolean;
  change: {
    grams: number;
    percent: number | null;
    fromCapitalGrams: number;
  } | null;
}

export interface CapitalSeriesOptions {
  from?: Date;
  to?: Date;
  granularity: Granularity;
}

export interface CapitalSeriesResult {
  range: { from: Date; to: Date; granularity: Granularity };
  opening: { goldGrams: number; cashToman: number; date: Date };
  series: CapitalPoint[];
  snapshot: CapitalSnapshot;
}

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
    throw new HttpError(
      409,
      "Shop settings have not been configured. Set the opening gold, cash and " +
        "date before requesting capital figures.",
    );
  }

  const now = new Date();

  const openingDate = settings.openingDate;

  const from = requestedFrom ?? openingDate;
  const to = requestedTo ?? now;

  const effectiveTo = new Date(Math.min(to.getTime(), now.getTime()));
  const effectiveGranularity = fitGranularity(from, effectiveTo, granularity);

  const points = buildPoints({
    from,
    to: effectiveTo,
    openingDate,
    granularity: effectiveGranularity,
  });

  const baselineAt = new Date(Math.max(from.getTime(), openingDate.getTime()));
  const nowExclusive = new Date(now.getTime() + 1);

  const boundaries: Date[] = [openingDate];
  const pushBoundary = (at: Date) => {
    if (at.getTime() > boundaries[boundaries.length - 1]!.getTime()) {
      boundaries.push(at);
    }
  };

  pushBoundary(baselineAt);

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

function fitGranularity(
  from: Date,
  to: Date,
  requested: Granularity,
): Granularity {
  let granularity = requested;

  while (bucketStarts(from, to, granularity).length > MAX_POINTS) {
    const coarser = COARSER[granularity];
    if (!coarser) return granularity;
    granularity = coarser;
  }

  return granularity;
}

interface PointWindow {
  date: Date;
  at: Date;
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
    const at = new Date(
      Math.min(nextStart ? nextStart.getTime() - 1 : to.getTime(), to.getTime()),
    );

    if (at.getTime() < openingDate.getTime()) continue;

    windows.push({ date: start, at, endExclusive: new Date(at.getTime() + 1) });
  }

  return windows;
}

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

async function aggregatePayments(
  boundaries: Date[],
): Promise<Map<number, Deltas>> {
  const lower = boundaries[0]!;
  const upper = boundaries[boundaries.length - 1]!;

  const rows = await TransactionModel.aggregate<{ _id: unknown } & Deltas>([
    {
      $match: {
        createdAt: { $gte: lower, $lt: upper },
        payments: { $elemMatch: { paidAt: { $gte: lower, $lt: upper } } },
      },
    },
    { $unwind: "$payments" },
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

function sumWhen(type: "sell" | "buy", field: string) {
  return { $sum: { $cond: [{ $eq: ["$type", type] }, field, 0] } };
}

function toDeltaMap(
  rows: ({ _id: unknown } & Partial<Deltas>)[],
): Map<number, Deltas> {
  const map = new Map<number, Deltas>();

  for (const row of rows) {
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

function positionFrom(settings: ShopSettingsDocument, running: Deltas): Position {
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

function valueInGrams(position: Position, pricePerGram: number): number {
  if (pricePerGram <= 0) return round(position.goldGrams, 3);

  return round(
    position.goldGrams +
      (position.cash + position.receivables - position.payables) / pricePerGram,
    3,
  );
}

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
