/** Static fixtures for the component gallery. No API is wired up yet. */

export interface DemoInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  type: "sell" | "buy";
  goldType: "melted" | "new" | "second-hand";
  weightGrams: number;
  totalAmount: number;
  remainingAmount: number;
  status: "open" | "settled";
  createdAt: Date;
}

const NAMES = [
  "رسول کرمی",
  "صاحب محمدی",
  "مریم احمدی",
  "حسین رضایی",
  "زهرا موسوی",
  "علی نجفی",
  "فاطمه کریمی",
  "امیر حسینی",
  "سارا عباسی",
  "محمد قاسمی",
  "نرگس شریفی",
  "بهرام یزدانی",
];

const GOLD_TYPES: DemoInvoice["goldType"][] = ["melted", "new", "second-hand"];

export const demoInvoices: DemoInvoice[] = NAMES.map((customer, index) => {
  const weightGrams = Number((1.5 + index * 0.87).toFixed(2));
  const totalAmount = Math.round(weightGrams * 3_500_000);
  const paid = index % 3 === 0 ? totalAmount : Math.round(totalAmount * 0.4);

  return {
    id: `inv-${index}`,
    invoiceNumber: `INV-20260801-${String(index + 1).padStart(4, "0")}`,
    customer,
    type: index % 4 === 0 ? "buy" : "sell",
    goldType: GOLD_TYPES[index % GOLD_TYPES.length]!,
    weightGrams,
    totalAmount,
    remainingAmount: totalAmount - paid,
    status: totalAmount - paid === 0 ? "settled" : "open",
    // Spread backwards from a fixed date so the fixture is deterministic.
    createdAt: new Date(2026, 6, 31 - index * 2, 10, 30),
  };
});

export const demoChartData = [
  { label: "فروردین", sell: 420, buy: 240 },
  { label: "اردیبهشت", sell: 510, buy: 198 },
  { label: "خرداد", sell: 380, buy: 310 },
  { label: "تیر", sell: 620, buy: 275 },
  { label: "مرداد", sell: 745, buy: 402 },
  { label: "شهریور", sell: 588, buy: 355 },
];

export const GOLD_TYPE_LABELS: Record<DemoInvoice["goldType"], string> = {
  melted: "آب‌شده",
  new: "نو",
  "second-hand": "دست دوم",
};

export const TYPE_LABELS: Record<DemoInvoice["type"], string> = {
  sell: "فروش",
  buy: "خرید",
};
