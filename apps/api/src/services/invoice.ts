import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser } from "puppeteer-core";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";
import { TransactionModel } from "../models/transaction.model.js";
import { renderInvoiceHtml } from "./invoice-template.js";
import { trySend } from "./sms.js";
import { formatToman } from "../lib/jalali.js";

/**
 * Renders transaction invoices to PDF with headless Chrome.
 *
 * WHY puppeteer-core RATHER THAN puppeteer
 * ----------------------------------------
 * The full `puppeteer` package downloads its own Chromium on install, from
 * storage.googleapis.com -- which returns 403 in some regions, including the
 * one this shop operates in, so `pnpm install` fails outright. puppeteer-core
 * is the same library without that download: it drives a browser that is
 * already on the machine. Set CHROME_EXECUTABLE_PATH, or let the probe below
 * find a normal Chrome/Edge install.
 */

/* -------------------------------------------------------------------------- */
/* Paths                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The api package root, resolved from this module's own location.
 *
 * `../..` lands on the package root from both `src/services/` under tsx and
 * `dist/services/` after a build, so assets resolve identically in dev and
 * production. Deriving it from `process.cwd()` instead would break the moment
 * anything is started from another directory.
 */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const FONT_DIR = join(PACKAGE_ROOT, "assets", "fonts");

/** Absolute directory PDFs are written to. */
export const INVOICE_DIR = isAbsolute(env.INVOICE_STORAGE_DIR)
  ? env.INVOICE_STORAGE_DIR
  : join(PACKAGE_ROOT, env.INVOICE_STORAGE_DIR);

/* -------------------------------------------------------------------------- */
/* Fonts                                                                       */
/* -------------------------------------------------------------------------- */

const FONT_FACES = [
  { file: "Vazir-Regular-FD.woff2", weight: 400 },
  { file: "Vazir-Medium-FD.woff2", weight: 500 },
  { file: "Vazir-Bold-FD.woff2", weight: 700 },
];

let fontFacesCss: string | undefined;

/**
 * Builds the `@font-face` block with each woff2 inlined as a data URI.
 *
 * Inlined rather than linked because a headless browser will happily print a
 * page before an external font arrives, producing an invoice in a fallback
 * face -- and a fallback face for Persian text is usually tofu. Read once and
 * cached; the three files are ~125 KB and do not change at runtime.
 */
async function getFontFaces(): Promise<string> {
  if (fontFacesCss) return fontFacesCss;

  const blocks = await Promise.all(
    FONT_FACES.map(async ({ file, weight }) => {
      const data = await readFile(join(FONT_DIR, file));
      return `@font-face {
  font-family: Vazir;
  font-style: normal;
  font-weight: ${weight};
  font-display: block;
  src: url(data:font/woff2;base64,${data.toString("base64")}) format("woff2");
}`;
    }),
  );

  fontFacesCss = blocks.join("\n");
  return fontFacesCss;
}

/* -------------------------------------------------------------------------- */
/* Browser                                                                     */
/* -------------------------------------------------------------------------- */

/** Common install locations, checked in order when the env var is unset. */
const CHROME_CANDIDATES = [
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  // Linux / Docker
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChrome(): string {
  if (env.CHROME_EXECUTABLE_PATH) {
    if (!existsSync(env.CHROME_EXECUTABLE_PATH)) {
      throw new Error(
        `CHROME_EXECUTABLE_PATH points at a file that does not exist: ${env.CHROME_EXECUTABLE_PATH}`,
      );
    }
    return env.CHROME_EXECUTABLE_PATH;
  }

  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      "No Chrome/Chromium found for PDF rendering. Install one, or set " +
        "CHROME_EXECUTABLE_PATH to its location.",
    );
  }
  return found;
}

let browserPromise: Promise<Browser> | undefined;

/**
 * One browser for the process, reused across renders.
 *
 * Launching Chrome costs a second or more; doing it per invoice would dominate
 * the request. The promise (not the resolved browser) is memoised so that
 * concurrent first calls share a single launch instead of racing into several.
 */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: findChrome(),
        headless: true,
        // --no-sandbox is required to run as root, which is the norm in a
        // container. The pages we render are our own template, never
        // untrusted input, so the sandbox is not load-bearing here.
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      })
      .catch((error) => {
        // Don't cache a failed launch, or every later call replays the failure.
        browserPromise = undefined;
        throw error;
      });
  }
  return browserPromise;
}

/** Releases the browser. Called from the server's shutdown path. */
export async function closeInvoiceBrowser(): Promise<void> {
  if (!browserPromise) return;

  const browser = await browserPromise.catch(() => undefined);
  browserPromise = undefined;
  await browser?.close().catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Filenames                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Filenames must be unguessable, because GET /api/invoices/:filename is public
 * -- that is the point, so an SMS link opens without a login.
 *
 * That makes the URL itself the credential, so it has to carry real entropy.
 * Naming the file after the invoice number (`INV-20260802-0007.pdf`) would let
 * anyone walk the entire day's sales and read customer names, phone numbers
 * and amounts. The invoice number is kept as a human-readable prefix purely so
 * the files are recognisable on disk; the 32 hex characters after it are what
 * actually protects the document.
 */
function buildFilename(invoiceNumber: string): string {
  const token = randomBytes(16).toString("hex");
  return `${invoiceNumber}-${token}.pdf`;
}

/** Matches what `buildFilename` produces, and nothing else. */
export const INVOICE_FILENAME_PATTERN = /^INV-\d{8}-\d{4}-[0-9a-f]{32}\.pdf$/;

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

export interface GeneratedInvoice {
  filename: string;
  /** Absolute, because it is sent to a customer's phone by SMS. */
  url: string;
  path: string;
}

/**
 * Renders the invoice for a transaction, writes it to disk, and records the
 * URL on the transaction.
 *
 * Safe to call more than once: each call writes a new file with a fresh token
 * and repoints `invoicePdfUrl` at it. Older files are left in place, since a
 * link already sent by SMS should keep working.
 */
export interface GenerateInvoiceOptions {
  /**
   * Text the customer the link once it is rendered.
   *
   * Off by default so that re-rendering -- after payments are added, or to
   * retry a failed render -- does not text the customer again each time. The
   * create path opts in; the explicit endpoint does so only when asked.
   */
  notify?: boolean;
}

export async function generateInvoicePdf(
  transactionId: string,
  { notify = false }: GenerateInvoiceOptions = {},
): Promise<GeneratedInvoice> {
  const transaction = await TransactionModel.findById(transactionId).populate<{
    customer: { firstName: string; lastName: string; mobile: string };
  }>("customer", "firstName lastName mobile");

  if (!transaction) throw new HttpError(404, "Transaction not found");
  if (!transaction.customer) {
    throw new HttpError(409, "Cannot render an invoice for a deleted customer");
  }

  const html = renderInvoiceHtml({
    invoiceNumber: transaction.invoiceNumber,
    createdAt: transaction.createdAt,
    customer: {
      firstName: transaction.customer.firstName,
      lastName: transaction.customer.lastName,
      mobile: transaction.customer.mobile,
    },
    type: transaction.type,
    goldType: transaction.goldType,
    goldWeightGrams: transaction.goldWeightGrams,
    dailyGoldPricePerGram: transaction.dailyGoldPricePerGram,
    totalAmount: transaction.totalAmount,
    paidAmount: transaction.paidAmount,
    remainingAmount: transaction.remainingAmount,
    payments: transaction.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      bankType: payment.bankType ?? null,
      destinationCard: payment.destinationCard ?? null,
      paidAt: payment.paidAt,
    })),
    fontFaces: await getFontFaces(),
  });

  const pdf = await renderPdf(html);

  await mkdir(INVOICE_DIR, { recursive: true });
  const filename = buildFilename(transaction.invoiceNumber);
  const path = join(INVOICE_DIR, filename);
  await writeFile(path, pdf);

  const url = `${env.PUBLIC_API_URL.replace(/\/$/, "")}/api/invoices/${filename}`;

  // updateOne rather than save(): nothing else on the document changed, and a
  // save would re-run the pre-validate hook and rewrite derived fields for no
  // reason.
  await TransactionModel.updateOne(
    { _id: transaction._id },
    { $set: { invoicePdfUrl: url } },
  );

  if (notify) {
    // trySend never throws. The PDF exists and the URL is already persisted --
    // a gateway outage must not undo that, and the link stays retrievable from
    // the transaction either way.
    await trySend(
      transaction.customer.mobile,
      [
        `فاکتور ${transaction.invoiceNumber}`,
        `مبلغ: ${formatToman(transaction.totalAmount)} تومان`,
        `مشاهده: ${url}`,
      ].join("\n"),
      `invoice ${transaction.invoiceNumber}`,
    );
  }

  return { filename, url, path };
}

async function renderPdf(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // `domcontentloaded` rather than `networkidle0`: the document makes no
    // network requests at all, so waiting for the network to go quiet just
    // adds a fixed delay.
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // The fonts are data URIs, so they resolve immediately -- but only after
    // the CSS is parsed. Without this the first page can print in a fallback
    // face, which for Persian text means tofu.
    await page.evaluateHandle("document.fonts.ready");

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    // Always close the tab, even if rendering threw -- a leaked page is a
    // leaked renderer process, and they accumulate.
    await page.close().catch(() => undefined);
  }
}

/**
 * Fire-and-forget wrapper for the transaction creation path.
 *
 * Creation must not wait on Chrome, and must not fail because of it: the
 * transaction is the record of the sale, the PDF is only a rendering of it. A
 * failure here leaves `invoicePdfUrl` null, which the admin UI can retry
 * through POST /api/admin/transactions/:id/invoice.
 */
export function generateInvoicePdfInBackground(transactionId: string): void {
  // notify: this is the one path where the customer has not seen the invoice
  // yet, so it is the one that texts them the link.
  void generateInvoicePdf(transactionId, { notify: true }).catch((error) => {
    console.error(
      `[invoice] failed to generate PDF for transaction ${transactionId}:`,
      error,
    );
  });
}
