import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";
import { TransactionModel } from "../models/transaction.model.js";
import { renderInvoiceHtml } from "./invoice-template.js";
import { trySend } from "./sms.js";
import { formatToman } from "../lib/jalali.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const FONT_DIR = join(PACKAGE_ROOT, "assets", "fonts");

const FONT_FACES = [
  { file: "Vazir-Regular-FD.woff2", weight: 400 },
  { file: "Vazir-Medium-FD.woff2", weight: 500 },
  { file: "Vazir-Bold-FD.woff2", weight: 700 },
];

let fontFacesCss: string | undefined;

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

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/opt/render/project/.render/chrome/opt/google/chrome/chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const CACHED_BINARY_PATHS = [
  ["chrome-linux64", "chrome"],
  ["chrome-linux", "chrome"],
  ["chrome-win64", "chrome.exe"],
  ["chrome-win32", "chrome.exe"],
  ["chrome-mac-x64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
  ["chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
] as const;

function findCachedChrome(): string | undefined {
  const cacheDir =
    env.PUPPETEER_CACHE_DIR ?? join(homedir(), ".cache", "puppeteer");
  const chromeDir = join(cacheDir, "chrome");

  if (!existsSync(chromeDir)) return undefined;

  let builds: string[];
  try {
    builds = readdirSync(chromeDir).sort().reverse();
  } catch {
    return undefined;
  }

  for (const build of builds) {
    for (const [dir, binary] of CACHED_BINARY_PATHS) {
      const candidate = join(chromeDir, build, dir, ...binary.split("/"));
      if (existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

function findChrome(): string {
  const configured = [
    ["PUPPETEER_EXECUTABLE_PATH", env.PUPPETEER_EXECUTABLE_PATH],
    ["CHROME_EXECUTABLE_PATH", env.CHROME_EXECUTABLE_PATH],
  ] as const;

  for (const [name, value] of configured) {
    if (!value) continue;
    if (!existsSync(value)) {
      throw new Error(
        `${name} points at a file that does not exist: ${value}`,
      );
    }
    return value;
  }

  const found = findCachedChrome() ?? CHROME_CANDIDATES.find(existsSync);
  if (!found) {
    throw new Error(
      "No Chrome/Chromium found for PDF rendering. Set " +
        "PUPPETEER_EXECUTABLE_PATH to a browser binary, or install one with " +
        "`npx puppeteer browsers install chrome`. On Render, run that in the " +
        "build command with PUPPETEER_CACHE_DIR pointing inside the project, " +
        "since anything outside it is discarded before the service starts.",
    );
  }
  return found;
}

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  ...(env.PUPPETEER_SINGLE_PROCESS ? ["--single-process"] : []),
];

const LAUNCH_TIMEOUT_MS = 45_000;
const PROTOCOL_TIMEOUT_MS = 60_000;

let browserPromise: Promise<Browser> | undefined;

async function getBrowser(): Promise<Browser> {
  const cached = browserPromise;

  if (cached) {
    const existing = await cached.catch(() => undefined);
    if (existing?.connected) return existing;

    if (browserPromise === cached) browserPromise = undefined;
  }

  if (!browserPromise) {
    const executablePath = findChrome();

    const launch: Promise<Browser> = puppeteer
      .launch({
        executablePath,
        headless: true,
        args: LAUNCH_ARGS,
        timeout: LAUNCH_TIMEOUT_MS,
        protocolTimeout: PROTOCOL_TIMEOUT_MS,
      })
      .then((browser) => {
        browser.once("disconnected", () => {
          if (browserPromise === launch) browserPromise = undefined;
        });
        return browser;
      })
      .catch((error) => {
        if (browserPromise === launch) browserPromise = undefined;

        console.error(
          `[invoice] Chromium failed to launch (${executablePath}). On a 512 MB ` +
            "instance this is usually the OOM killer; otherwise the binary is " +
            "missing or not executable. Set PUPPETEER_EXECUTABLE_PATH to a " +
            "browser that exists on this host.",
          error,
        );
        throw error;
      });

    browserPromise = launch;
  }

  return browserPromise;
}

function describeRenderFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/Target closed|Session closed|Connection closed|detached/i.test(message)) {
    return (
      "Chromium died mid-render. On a 512 MB instance this is almost always the " +
      "OOM killer taking the renderer. Retry the invoice; if it repeats, drop " +
      "--single-process from LAUNCH_ARGS or move to a larger instance."
    );
  }

  if (/timed out|timeout/i.test(message)) {
    return (
      `Chromium stopped responding (over ${PROTOCOL_TIMEOUT_MS / 1000}s). The ` +
      "renderer is wedged or was OOM-killed without closing its connection."
    );
  }

  if (/spawn|ENOENT|executable|Failed to launch/i.test(message)) {
    return (
      "Chromium could not be started. Check PUPPETEER_EXECUTABLE_PATH points " +
      "at a binary that exists and is executable on this host."
    );
  }

  return "PDF rendering failed.";
}

export async function closeInvoiceBrowser(): Promise<void> {
  if (!browserPromise) return;

  const browser = await browserPromise.catch(() => undefined);
  browserPromise = undefined;
  await browser?.close().catch(() => undefined);
}

const CLOUDINARY_FOLDER = "g-dash/invoices";

let cloudinaryConfigured = false;

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
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

function buildPublicId(invoiceNumber: string): string {
  const token = randomBytes(16).toString("hex");
  return `${CLOUDINARY_FOLDER}/${invoiceNumber}-${token}.pdf`;
}

function uploadPdf(pdf: Uint8Array, publicId: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        unique_filename: false,
        use_filename: false,
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
  filename: string;
  url: string;
}

export interface GenerateInvoiceOptions {
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
    profitPercentage: transaction.profitPercentage,
    profitAmount: transaction.profitAmount,
    totalAmount: transaction.totalAmount,
    paidAmount: transaction.paidAmount,
    remainingAmount: transaction.remainingAmount,
    payments: transaction.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      bankType: payment.bankType ?? null,
      destinationCard: payment.destinationCard ?? null,
      destinationIban: payment.destinationIban ?? null,
      paidAt: payment.paidAt,
    })),
    fontFaces: await getFontFaces(),
  });

  const pdf = await renderPdf(html, transaction.invoiceNumber);

  const filename = buildPublicId(transaction.invoiceNumber);
  const uploaded = await uploadPdf(pdf, filename);

  const url = uploaded.secure_url;

  await TransactionModel.updateOne(
    { _id: transaction._id },
    { $set: { invoicePdfUrl: url } },
  );

  if (notify) {
    await trySend(
      transaction.customer.mobile,
      buildInvoiceSmsText(transaction.invoiceNumber, transaction.totalAmount, url),
      `invoice ${transaction.invoiceNumber}`,
    );
  }

  return { filename, url };
}

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

async function renderPdf(html: string, invoiceNumber: string): Promise<Uint8Array> {
  let page: Page | undefined;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    await page.evaluateHandle("document.fonts.ready");

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } catch (error) {
    console.error(
      `[invoice] render failed for ${invoiceNumber}: ${describeRenderFailure(error)}`,
      error,
    );

    void closeInvoiceBrowser().catch(() => undefined);

    throw new HttpError(
      503,
      "Could not render the invoice PDF. The transaction is saved; try again.",
    );
  } finally {
    await page?.close().catch(() => undefined);
  }
}

export function generateInvoicePdfInBackground(transactionId: string): void {
  void generateInvoicePdf(transactionId, { notify: true }).catch((error) => {
    console.error(
      `[invoice] failed to generate PDF for transaction ${transactionId}:`,
      error,
    );
  });
}
