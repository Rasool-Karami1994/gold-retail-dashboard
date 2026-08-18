import { apiFetch } from "./api";
import { toApiDate, type DateRange, type DateRangePreset } from "./jalali";

/**
 * Capital measured in grams of gold.
 *
 * The shop's position is gold, not currency: metal in the safe, plus what its
 * cash would buy at today's rate, plus what customers owe it, less what it
 * owes them. The API recomputes the whole series from the transactions on
 * every request -- see capital.service.ts for why it is never a stored total.
 *
 * Three resources behind one screen, so they share a file and a key namespace:
 * the opening position, the daily gold price, and the series computed from
 * both. Recording a price invalidates the series, which is the only coupling
 * a caller has to remember.
 */

/* -------------------------------------------------------------------------- */
/* Opening position                                                           */
/* -------------------------------------------------------------------------- */

export interface ShopSettings {
  openingGoldGrams: number;
  openingCashToman: number;
  /** ISO string. */
  openingDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopSettingsResponse {
  /**
   * False until the shop has ever been configured. The screen shows a setup
   * form instead of the figures, because capital measured from an unknown
   * starting position is not a smaller answer -- it is a wrong one.
   */
  configured: boolean;
  settings: ShopSettings | null;
}

export interface ShopSettingsInput {
  openingGoldGrams: number;
  openingCashToman: number;
  /** `YYYY-MM-DD`, built with `toApiDate` -- never `toISOString()`. */
  openingDate: string;
}

export function fetchShopSettings() {
  return apiFetch<ShopSettingsResponse>("/api/admin/shop-settings");
}

/** Creates the opening position on the first call, updates it after that. */
export function saveShopSettings(input: ShopSettingsInput) {
  return apiFetch<ShopSettings>("/api/admin/shop-settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/* -------------------------------------------------------------------------- */
/* Daily gold price                                                           */
/* -------------------------------------------------------------------------- */

export interface GoldPrice {
  id: string;
  /** ISO string, normalised to the start of the shop's day. */
  date: string;
  pricePerGram: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoldPriceContext {
  /** Today's price, when one has been recorded. Prefills the form. */
  today: GoldPrice | null;
  /** The most recent price of any day -- what the figures carry forward from. */
  latest: GoldPrice | null;
}

export function fetchGoldPrice() {
  return apiFetch<GoldPriceContext>("/api/admin/gold-prices");
}

/** Records today's price, or corrects it if one is already on record. */
export function recordGoldPrice(pricePerGram: number) {
  return apiFetch<GoldPrice>("/api/admin/gold-prices", {
    method: "POST",
    body: JSON.stringify({ pricePerGram }),
  });
}

/* -------------------------------------------------------------------------- */
/* The series                                                                 */
/* -------------------------------------------------------------------------- */

export type Granularity = "day" | "week" | "month";

export interface CapitalPoint {
  /** Bucket start, as an instant. */
  date: string;
  /**
   * The same bucket start as a plain `YYYY-MM-DD` on the shop's calendar, and
   * what the chart labels the point with.
   *
   * `date` is midnight in Tehran expressed as an instant, so formatting it
   * through the browser's own clock shifts the label a day in either direction
   * -- a monthly series read on a UTC machine labels every bucket with the last
   * day of the month before. Parse this with `fromApiDate`, never `new Date()`.
   */
  day: string;
  /** The instant the figures are measured at: the end of the bucket. */
  at: string;
  capitalGrams: number;
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
  pricePerGram: number;
  /**
   * No price was recorded for this day and the last known one was carried
   * forward, so the figure is an estimate. The chart marks these points.
   */
  estimated: boolean;
}

export interface CapitalSnapshot {
  at: string;
  /** Null when no gold price has ever been recorded. */
  capitalGrams: number | null;
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
  pricePerGram: number | null;
  estimated: boolean;
  change: {
    grams: number;
    /** Null when the opening figure was zero, which has no percentage. */
    percent: number | null;
    fromCapitalGrams: number;
  } | null;
}

export interface CapitalResponse {
  range: {
    from: string;
    to: string;
    /**
     * What the API actually used. It coarsens a range too long to plot at the
     * requested granularity, so this can differ from what was asked for.
     */
    granularity: Granularity;
  };
  opening: { goldGrams: number; cashToman: number; date: string };
  series: CapitalPoint[];
  snapshot: CapitalSnapshot;
}

/**
 * How finely to slice each preset.
 *
 * A year of daily points is 365 vertices on a line a few hundred pixels wide --
 * unreadable, and mostly redundant when the shop trades a handful of times a
 * week. Long ranges therefore step down to months. The API applies its own cap
 * on top and reports back what it used.
 */
export function granularityForPreset(preset: DateRangePreset): Granularity {
  switch (preset) {
    case "today":
    case "week":
      return "day";
    case "month":
      return "day";
    case "year":
      return "month";
    // A custom range can be any length, so it is decided by span below.
    case "custom":
      return "day";
  }
}

const DAY_MS = 86_400_000;

/** Granularity for an arbitrary range, by how long it is. */
export function granularityForRange(range: DateRange): Granularity {
  if (range.preset !== "custom") return granularityForPreset(range.preset);

  const days = (range.to.getTime() - range.from.getTime()) / DAY_MS;
  if (days > 400) return "month";
  if (days > 90) return "week";
  return "day";
}

export function fetchCapital(range: DateRange, granularity: Granularity) {
  const params = new URLSearchParams({
    // `toApiDate`, never `toISOString().slice(0, 10)` -- the range boundaries
    // are local midnights, and UTC reports those as the previous day here.
    from: toApiDate(range.from),
    to: toApiDate(range.to),
    granularity,
  });

  return apiFetch<CapitalResponse>(`/api/admin/capital?${params.toString()}`);
}

/**
 * Keyed on the range's endpoints rather than the object: a `DateRange` carries
 * fresh `Date` instances on every render and TanStack hashes keys structurally,
 * so the object itself would miss the cache every time.
 */
export const capitalKeys = {
  all: ["capital"] as const,
  settings: () => ["capital", "settings"] as const,
  price: () => ["capital", "price"] as const,
  series: (range: DateRange, granularity: Granularity) =>
    [
      "capital",
      "series",
      toApiDate(range.from),
      toApiDate(range.to),
      granularity,
    ] as const,
};
