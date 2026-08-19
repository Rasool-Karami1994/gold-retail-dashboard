import { apiFetch } from "./api";
import { toApiDate, type DateRange, type DateRangePreset } from "./jalali";

export interface ShopSettings {
  openingGoldGrams: number;
  openingCashToman: number;
  openingDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopSettingsResponse {
  configured: boolean;
  settings: ShopSettings | null;
}

export interface ShopSettingsInput {
  openingGoldGrams: number;
  openingCashToman: number;
  openingDate: string;
}

export function fetchShopSettings() {
  return apiFetch<ShopSettingsResponse>("/api/admin/shop-settings");
}

export function saveShopSettings(input: ShopSettingsInput) {
  return apiFetch<ShopSettings>("/api/admin/shop-settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface GoldPrice {
  id: string;
  date: string;
  pricePerGram: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoldPriceContext {
  today: GoldPrice | null;
  latest: GoldPrice | null;
}

export function fetchGoldPrice() {
  return apiFetch<GoldPriceContext>("/api/admin/gold-prices");
}

export function recordGoldPrice(pricePerGram: number) {
  return apiFetch<GoldPrice>("/api/admin/gold-prices", {
    method: "POST",
    body: JSON.stringify({ pricePerGram }),
  });
}

export type Granularity = "day" | "week" | "month";

export interface CapitalPoint {
  date: string;
  day: string;
  at: string;
  capitalGrams: number;
  goldGrams: number;
  cash: number;
  receivables: number;
  payables: number;
  pricePerGram: number;
  estimated: boolean;
}

export interface CapitalSnapshot {
  at: string;
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

export interface CapitalResponse {
  range: {
    from: string;
    to: string;
    granularity: Granularity;
  };
  opening: { goldGrams: number; cashToman: number; date: string };
  series: CapitalPoint[];
  snapshot: CapitalSnapshot;
}

export function granularityForPreset(preset: DateRangePreset): Granularity {
  switch (preset) {
    case "today":
    case "week":
      return "day";
    case "month":
      return "day";
    case "year":
      return "month";
    case "custom":
      return "day";
  }
}

const DAY_MS = 86_400_000;

export function granularityForRange(range: DateRange): Granularity {
  if (range.preset !== "custom") return granularityForPreset(range.preset);

  const days = (range.to.getTime() - range.from.getTime()) / DAY_MS;
  if (days > 400) return "month";
  if (days > 90) return "week";
  return "day";
}

export function fetchCapital(range: DateRange, granularity: Granularity) {
  const params = new URLSearchParams({
    from: toApiDate(range.from),
    to: toApiDate(range.to),
    granularity,
  });

  return apiFetch<CapitalResponse>(`/api/admin/capital?${params.toString()}`);
}

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
