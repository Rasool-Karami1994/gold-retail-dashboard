import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
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
 *
 * A CACHED BROWSER CAN DIE WITHOUT THIS FUNCTION BEING TOLD. It is a child
 * process: it can crash, be OOM-killed, or be reaped by a container runtime,
 * and the promise memoised here goes on resolving to the corpse. Every later
 * render then fails with `ConnectionClosedError: Connection closed.` for the
 * life of the process -- invoices simply stop being produced until someone
 * restarts the API.
 *
 * So liveness is checked on the way in, and `disconnected` clears the cache as
 * soon as it happens. Both, deliberately: the event handles the common case
 * promptly, and the check still covers anything that slips past it.
 */
async function getBrowser(): Promise<Browser> {
  const cached = browserPromise;

  if (cached) {
    const existing = await cached.catch(() => undefined);
    if (existing?.connected) return existing;

    // Dead or failed. Clear it -- but only if nothing has replaced it while we
    // were awaiting, or we would discard a healthy relaunch.
    if (browserPromise === cached) browserPromise = undefined;
  }

  if (!browserPromise) {
    const launch: Promise<Browser> = puppeteer
      .launch({
        executablePath: findChrome(),
        headless: true,
        // --no-sandbox is required to run as root, which is the norm in a
        // container. The pages we render are our own template, never
        // untrusted input, so the sandbox is not load-bearing here.
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      })
      .then((browser) => {
        browser.once("disconnected", () => {
          if (browserPromise === launch) browserPromise = undefined;
        });
        return browser;
      })
      .catch((error) => {
        // Don't cache a failed launch, or every later call replays the failure.
        if (browserPromise === launch) browserPromise = undefined;
        throw error;
      });

    browserPromise = launch;
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

/**
 * WHERE INVOICES LIVE, AND WHY NOT ON DISK.
 *
 * Render's filesystem is ephemeral: it is rebuilt on every deploy and every
 * restart. A PDF written locally disappears, and the link already texted to the
 * customer starts answering 404 with nothing in the app noticing, because
 * `invoicePdfUrl` is still recorded on the transaction. So the rendered buffer
 * goes straight to Cloudinary and the delivery URL is what gets stored.
 *
 * `resource_type: "raw"` because a PDF is not an image to Cloudinary. Its image
 * pipeline would try to transform and rasterise it; raw stores and serves the
 * bytes untouched.
 */
const CLOUDINARY_FOLDER = "g-dash/invoices";

let cloudinaryConfigured = false;

/**
 * Configured on first use rather than at import.
 *
 * Importing this module must stay free of side effects -- the seed script and
 * the tests pull in the transaction model through it, and neither renders an
 * invoice or should need credentials to load.
 */
function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    // Reached only in development -- env.ts requires all three in production,
    // so a misconfigured deployment fails at boot instead of here. Locally this
    // surfaces as a failed render, which the app already handles: the sale is
    // recorded, `invoicePdfUrl` stays null, and the detail screen offers a retry.
    throw new Error(
      "Cloudinary is not configured, so the invoice cannot be stored. Set " +
        "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET " +
        "in apps/api/.env -- the free tier is enough for development.",
    );
  }

  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudinaryConfigured = true;
  }

  return cloudinary;
}

/**
 * The delivery URL is public, so the public_id has to carry the entropy.
 *
 * A raw Cloudinary asset is readable by anyone who knows its URL -- that is the
 * requirement, since the customer opens it from an SMS with no account. It also
 * means the id IS the credential, exactly as the on-disk filename was. Naming
 * an invoice after its number alone (`INV-20260802-0007`) would let anyone walk
 * a day's sales and read customer names, numbers and amounts, so the number is
 * only a human-readable prefix and the 32 hex characters after it are what
 * actually protect the document.
 *
 * The `.pdf` suffix is deliberate: for a raw resource Cloudinary uses the
 * public_id verbatim as the delivery path, so without it the URL has no
 * extension and phones are less consistent about opening it in a PDF viewer.
 */
function buildPublicId(invoiceNumber: string): string {
  const token = randomBytes(16).toString("hex");
  return `${CLOUDINARY_FOLDER}/${invoiceNumber}-${token}.pdf`;
}

/**
 * Uploads the rendered bytes and resolves to Cloudinary's response.
 *
 * `upload_stream` rather than `upload`, because the PDF is already a Buffer in
 * memory -- the plain `upload` call takes a path or a data URI, and base64ing a
 * few hundred KB only to have the SDK decode it again is pure overhead.
 */
function uploadPdf(pdf: Uint8Array, publicId: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        // The id already carries 128 bits of entropy; letting Cloudinary append
        // its own suffix would only make the stored URL harder to correlate
        // with the asset when one has to be found in the dashboard.
        unique_filename: false,
        use_filename: false,
        // Each render gets a fresh id, so a collision means something is wrong
        // and silently replacing an existing invoice is the worst answer.
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result);
      },
    );

    stream.end(pdf);
  });
}

export interface GeneratedInvoice {
  /** Cloudinary public_id, including the folder and the .pdf suffix. */
  filename: string;
  /** Absolute HTTPS delivery URL, because it is sent to a customer's phone. */
  url: string;
}

/**
 * Renders the invoice for a transaction, uploads it, and records the URL.
 *
 * Safe to call more than once: each call uploads a new asset under a fresh id
 * and repoints `invoicePdfUrl` at it. Superseded assets are left in Cloudinary
 * on purpose, since a link already sent by SMS should keep working -- which
 * also means storage grows with every re-render and nothing prunes it.
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

  const filename = buildPublicId(transaction.invoiceNumber);
  const uploaded = await uploadPdf(pdf, filename);

  // secure_url, never `url`: the latter is http, and an http link in an SMS is
  // both downgraded by some clients and refused outright by others.
  const url = uploaded.secure_url;

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
      buildInvoiceSmsText(transaction.invoiceNumber, transaction.totalAmount, url),
      `invoice ${transaction.invoiceNumber}`,
    );
  }

  return { filename, url };
}

/**
 * The text a customer receives with their invoice link.
 *
 * Exported because the mock path shows the admin exactly what *would* have been
 * sent, so they can pass it on by hand. Built in one place so the message the
 * screen offers to copy cannot drift from the one the gateway delivers.
 */
export function buildInvoiceSmsText(
  invoiceNumber: string,
  totalAmount: number,
  url: string,
): string {
  return [
    `فاکتور ${invoiceNumber}`,
    `مبلغ: ${formatToman(totalAmount)} تومان`,
    `مشاهده: ${url}`,
  ].join("\n");
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
