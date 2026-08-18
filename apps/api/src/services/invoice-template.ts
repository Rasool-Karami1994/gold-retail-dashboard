import {
  formatGrams,
  formatJalaliDateTime,
  formatPercent,
  formatToman,
} from "../lib/jalali.js";
import {
  type BankType,
  type GoldType,
  type PaymentMethod,
  type TransactionType,
} from "../models/transaction.model.js";

/**
 * The printed invoice, as a single self-contained HTML string.
 *
 * Everything is inlined -- fonts as base64, all CSS in a <style> block -- so
 * the renderer never makes a network request. A headless browser that has to
 * fetch a stylesheet may screenshot the page before it arrives, which shows up
 * as an invoice that is correct nine times out of ten.
 */

const TYPE_LABELS: Record<TransactionType, string> = {
  sell: "فروش به مشتری",
  buy: "خرید از مشتری",
};

const GOLD_TYPE_LABELS: Record<GoldType, string> = {
  melted: "آب‌شده",
  new: "نو",
  "second-hand": "دست‌دوم",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقدی",
  bank: "بانکی",
};

const BANK_TYPE_LABELS: Record<BankType, string> = {
  paya: "پایا",
  "card-to-card": "کارت به کارت",
  bridge: "پل",
  satna: "ساتنا",
};

/**
 * Escapes text bound for the template.
 *
 * Customer names are free text that a staff member typed. Without this, a name
 * containing `<` corrupts the layout, and the document is rendered by a real
 * browser -- so a crafted name would be script execution inside the renderer,
 * not just a broken invoice.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Placeholder shop identity. Swap for real values, or lift into config once
 * there is a settings collection to hold them.
 */
export const SHOP_INFO = {
  name: "گالری طلای روزبه رضاوندی",
  branch: "مرکز خرید و فروش طلا و ارز",
  phone: "7291603-0831",
  mobile: "09183336491",
  address: "کرمانشاه- بازار زرگرها- پاساژ کوروش",
} as const;

export interface InvoiceTemplateData {
  invoiceNumber: string;
  createdAt: Date;
  customer: { firstName: string; lastName: string; mobile: string };
  type: TransactionType;
  goldType: GoldType;
  goldWeightGrams: number;
  dailyGoldPricePerGram: number;
  profitPercentage: number;
  profitAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    bankType?: BankType | null;
    destinationCard?: string | null;
    destinationIban?: string | null;
    paidAt: Date;
  }>;
  /** `@font-face` block with the fonts already base64-inlined. */
  fontFaces: string;
}

export function renderInvoiceHtml(data: InvoiceTemplateData): string {
  const {
    invoiceNumber,
    createdAt,
    customer,
    type,
    goldType,
    goldWeightGrams,
    dailyGoldPricePerGram,
    profitPercentage,
    profitAmount,
    totalAmount,
    paidAmount,
    remainingAmount,
    payments,
    fontFaces,
  } = data;

  const settled = remainingAmount === 0;

  /**
   * The margin, and which way it moved.
   *
   * Printed from the STORED figures, never recomputed here: an invoice already
   * in a customer's hands has to keep saying what it said, whatever the rule
   * becomes later. Omitted entirely at 0% -- a row reading "+ ۰" on every
   * invoice that never had a margin is noise, and every record written before
   * the field existed is one of those.
   */
  const baseAmount = type === "buy" ? totalAmount + profitAmount : totalAmount - profitAmount;

  const profitRow =
    profitPercentage > 0
      ? `<tr><td>${type === "buy" ? "کسر سود" : "سود"} (${formatPercent(
          profitPercentage,
        )})</td><td>${type === "buy" ? "−" : "+"} ${formatToman(
          profitAmount,
        )}</td></tr>`
      : "";

  // Who the outstanding balance belongs to depends on the direction of the
  // deal -- see the header comment in transaction.model.ts.
  const remainingLabel = settled
    ? "تسویه شده"
    : type === "sell"
      ? "مانده — بدهی مشتری"
      : "مانده — بدهی فروشگاه";

  const paymentRows = payments.length
    ? payments
        .map((payment, index) => {
          const detail =
            payment.method === "bank"
              ? [
                  payment.bankType ? BANK_TYPE_LABELS[payment.bankType] : null,
                  // Whichever destination this route records. Only the last
                  // four characters are printed -- the invoice is readable by
                  // anyone holding the link.
                  //
                  // The masked run is bidi-isolated. Without it the digits are
                  // a left-to-right island inside right-to-left text, so
                  // "****7890" reorders on screen to "7890****", which reads as
                  // though the FIRST four were the visible ones. Same
                  // characters, opposite meaning.
                  payment.destinationCard
                    ? `کارت <span class="mask">****${escapeHtml(
                        payment.destinationCard.slice(-4),
                      )}</span>`
                    : payment.destinationIban
                      ? `شبا <span class="mask">****${escapeHtml(
                          payment.destinationIban.slice(-4),
                        )}</span>`
                      : null,
                ]
                  .filter(Boolean)
                  .join(" — ")
              : "—";

          return `
            <tr>
              <td class="num">${formatToman(index + 1)}</td>
              <td>${METHOD_LABELS[payment.method]}</td>
              <td>${detail}</td>
              <td class="ltr">${formatJalaliDateTime(payment.paidAt)}</td>
              <td class="amount">${formatToman(payment.amount)}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="empty">پرداختی ثبت نشده است</td></tr>`;

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(invoiceNumber)}</title>
<style>
${fontFaces}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Vazir, sans-serif;
  font-size: 11pt;
  line-height: 1.9;
  color: #16181f;
  padding: 14mm 12mm;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #16181f;
  padding-bottom: 6mm;
  margin-bottom: 6mm;
}
.shop-name { font-size: 17pt; font-weight: 700; }
.shop-meta { font-size: 9pt; color: #5c6270; margin-top: 1mm; }
.doc-title { font-size: 13pt; font-weight: 700; text-align: left; }
.doc-meta { font-size: 9pt; color: #5c6270; text-align: left; margin-top: 1mm; }
.invoice-no { font-weight: 700; letter-spacing: .04em; }

.badge {
  display: inline-block;
  border: 1px solid currentColor;
  border-radius: 3mm;
  padding: 0.4mm 2.5mm;
  font-size: 9pt;
  margin-top: 1.5mm;
}
.badge.sell { color: #8a4a00; }
.badge.buy  { color: #12503a; }

.section-title {
  font-size: 9pt;
  font-weight: 700;
  color: #5c6270;
  letter-spacing: .06em;
  margin: 5mm 0 2mm;
}

table { width: 100%; border-collapse: collapse; }
th, td {
  border: 1px solid #d3d7e0;
  padding: 2mm 2.5mm;
  text-align: right;
  vertical-align: middle;
}
th {
  background: #f1f3f8;
  font-size: 9pt;
  font-weight: 700;
  color: #3d434f;
}
td.amount, th.amount { text-align: left; font-variant-numeric: tabular-nums; }
td.num { width: 10mm; color: #5c6270; }
td.ltr { direction: ltr; text-align: right; font-size: 9pt; color: #5c6270; }
/* Keeps a masked card number in its written order inside RTL text. */
.mask { direction: ltr; unicode-bidi: isolate; }
td.empty { text-align: center; color: #8b91a0; padding: 5mm; }

.kv { width: 100%; }
.kv td { border: none; padding: 1mm 0; }
.kv td:first-child { color: #5c6270; width: 34mm; }

.totals { margin-top: 5mm; margin-right: auto; width: 78mm; }
.totals td { border: none; padding: 1.4mm 0; }
.totals td:last-child { text-align: left; font-variant-numeric: tabular-nums; }
.totals tr.grand td {
  border-top: 1px solid #d3d7e0;
  padding-top: 2.4mm;
  font-weight: 700;
  font-size: 12pt;
}
.totals tr.remaining td {
  border-top: 2px solid #16181f;
  padding-top: 2.4mm;
  font-weight: 700;
}
.totals tr.remaining.settled td { color: #12503a; }
.totals tr.remaining.due td { color: #97230f; }

.foot {
  margin-top: 10mm;
  padding-top: 3mm;
  border-top: 1px solid #d3d7e0;
  font-size: 8.5pt;
  color: #8b91a0;
  display: flex;
  justify-content: space-between;
}
</style>
</head>
<body>

<div class="head">
  <div>
    <div class="shop-name">${escapeHtml(SHOP_INFO.name)}</div>
    <div class="shop-meta">${escapeHtml(SHOP_INFO.branch)} — ${escapeHtml(SHOP_INFO.phone)}</div>
        <div class="shop-name">${escapeHtml(SHOP_INFO.mobile)}</div>

    <div class="shop-meta">${escapeHtml(SHOP_INFO.address)}</div>
  </div>
  <div>
    <div class="doc-title">فاکتور</div>
    <div class="doc-meta invoice-no">${escapeHtml(invoiceNumber)}</div>
    <div class="doc-meta">${formatJalaliDateTime(createdAt)}</div>
    <div class="badge ${type}">${TYPE_LABELS[type]}</div>
  </div>
</div>

<div class="section-title">مشخصات مشتری</div>
<table class="kv">
  <tr>
    <td>نام</td>
    <td>${escapeHtml(`${customer.firstName} ${customer.lastName}`.trim())}</td>
  </tr>
  <tr>
    <td>شماره تماس</td>
    <td>${escapeHtml(customer.mobile)}</td>
  </tr>
</table>

<div class="section-title">شرح معامله</div>
<table>
  <thead>
    <tr>
      <th>نوع طلا</th>
      <th>وزن (گرم)</th>
      <th>نرخ روز (تومان بر گرم)</th>
      <th class="amount">مبلغ پایه (تومان)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${GOLD_TYPE_LABELS[goldType]}</td>
      <td>${formatGrams(goldWeightGrams)}</td>
      <td>${formatToman(dailyGoldPricePerGram)}</td>
      <td class="amount">${formatToman(baseAmount)}</td>
    </tr>
  </tbody>
</table>

<div class="section-title">پرداخت‌ها</div>
<table>
  <thead>
    <tr>
      <th>ردیف</th>
      <th>روش</th>
      <th>جزئیات</th>
      <th>تاریخ</th>
      <th class="amount">مبلغ (تومان)</th>
    </tr>
  </thead>
  <tbody>${paymentRows}</tbody>
</table>

<table class="totals">
  <tr><td>مبلغ پایه</td><td>${formatToman(baseAmount)}</td></tr>
  ${profitRow}
  <tr class="grand"><td>مبلغ کل</td><td>${formatToman(totalAmount)}</td></tr>
  <tr><td>پرداخت‌شده</td><td>${formatToman(paidAmount)}</td></tr>
  <tr class="remaining ${settled ? "settled" : "due"}">
    <td>${remainingLabel}</td>
    <td>${formatToman(remainingAmount)}</td>
  </tr>
</table>

<div class="foot">
  <span>این فاکتور به صورت اتوماتیک صادر شده است.</span>
  <span>${escapeHtml(invoiceNumber)}</span>
</div>

</body>
</html>`;
}
