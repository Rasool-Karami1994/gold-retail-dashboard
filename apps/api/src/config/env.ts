import "dotenv/config";
import { z } from "zod";

/**
 * Environment is parsed once, at boot, and the process exits if anything is
 * missing or malformed. Everywhere else imports the typed `env` object, so a
 * typo in a variable name is a compile error rather than a runtime `undefined`.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  /**
   * Mongo connection string.
   *
   * `MONGO_URI` is the name managed hosts hand you; `MONGODB_URI` is what this
   * repo used first and what docker-compose.yml still sets. Both are accepted
   * and resolved below, because renaming one would silently break whichever
   * deployment was already using the other.
   */
  MONGO_URI: z.string().min(1).optional(),
  MONGODB_URI: z.string().min(1).optional(),

  /**
   * Comma-separated list of browser origins allowed to call this API.
   *
   * `CORS_ORIGIN` is the former name, still accepted for the same reason as
   * above. On separate domains this MUST name the deployed frontend exactly --
   * scheme, host and port, no trailing slash. A wrong value produces no
   * server-side error at all: the request succeeds, the browser discards the
   * response, and the app looks broken with a clean API log.
   */
  ALLOWED_ORIGIN: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),

  /**
   * Public origin of the FRONTEND, e.g. https://g-dash.vercel.app.
   *
   * Distinct from PUBLIC_API_URL, which is this API's own origin. Nothing reads
   * it yet; it exists so that anything building a link back into the web app
   * (a password-reset mail, an SMS deep link) has one place to read rather than
   * reconstructing it from ALLOWED_ORIGIN.
   */
  APP_BASE_URL: z.string().url().optional(),

  LOG_FORMAT: z.string().default("dev"),

  // 32 chars is the floor for a usable HS256 secret. Generate one with:
  //   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  /** Cost factor for bcrypt. 12 is ~250ms on modern hardware. */
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  /** Set for cross-subdomain cookies (e.g. ".example.com"). Usually unset. */
  COOKIE_DOMAIN: z.string().optional(),

  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(5),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  /** Wrong guesses allowed before a code is burned. */
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Rate limit on request-otp, keyed by mobile. */
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
  OTP_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),

  /**
   * How long a verified 'register' code stays usable as proof for
   * POST /api/admin/customers. This is the staff member's window to fill in
   * the customer's name after the code is confirmed -- much longer than the
   * code's own 2-minute life, because by this point identity is established
   * and the remaining risk is only a stale form.
   */
  REGISTRATION_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  /**
   * Which SmsProvider implementation to load. See services/sms.ts.
   *
   * `mock` delivers nothing and hands the message text back to the caller, so
   * the app is fully usable without a gateway account. `console` is the older
   * name for the same stub and still works. The default is decided below, from
   * whether a Kavenegar key is present at all.
   */
  // Preprocessed so a blank `SMS_PROVIDER=` in .env means "unset" rather than
  // failing the enum -- an empty value is how people disable a line, and a boot
  // crash is a hostile answer to it.
  SMS_PROVIDER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["mock", "console", "kavenegar"]).optional(),
  ),

  /**
   * Kavenegar credentials. Optional at the schema level because the console
   * provider needs neither; the refinement below makes the key mandatory once
   * SMS_PROVIDER=kavenegar, so a misconfigured deployment fails at boot rather
   * than on the first customer login.
   */
  KAVENEGAR_API_KEY: z.string().optional(),
  /**
   * Sending line, e.g. 100020003. Only used for plain messages -- one-time
   * codes go through an approved template on verify/lookup, which uses the
   * line configured on the template instead.
   */
  KAVENEGAR_SENDER: z.string().optional(),

  /**
   * Public origin of this API, used to build the absolute invoice URL that
   * goes out by SMS. Must be reachable from a customer's phone -- localhost
   * is fine in dev and wrong everywhere else.
   */
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),

  /**
   * Path to a Chrome/Chromium binary for PDF rendering.
   *
   * We use puppeteer-core, which drives an existing browser rather than
   * downloading its own -- Google's browser CDN returns 403 from some regions,
   * which makes the bundled-Chromium install fail outright. Leave unset to
   * auto-detect the usual install locations; set it explicitly in Docker.
   */
  CHROME_EXECUTABLE_PATH: z.string().optional(),

  /**
   * Where generated PDFs are written. Relative paths resolve to the api root.
   *
   * ON A HOST WITH AN EPHEMERAL FILESYSTEM (Render's default, Fly without a
   * volume, any container that is replaced on deploy) THIS DIRECTORY DOES NOT
   * SURVIVE A RESTART. Every invoice link already texted to a customer answers
   * 404 after the next deploy, and nothing in the app notices -- the URL is
   * still on the transaction. Mount a disk here, or move storage to an object
   * store; the Cloudinary block below is the placeholder for the latter.
   */
  INVOICE_STORAGE_DIR: z.string().default("uploads/invoices"),

  /**
   * Cloudinary credentials for invoice storage.
   *
   * NOTHING READS THESE YET. Invoices are written to INVOICE_STORAGE_DIR on
   * local disk (see services/invoice.ts). They are declared here so the three
   * are validated as a set the moment someone wires the upload up, and so a
   * deployment can carry them before the code lands.
   */
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Consumed only by `pnpm --filter api seed:admin`, never by the server.
  SEED_ADMIN_USERNAME: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
})
  // Catch a half-configured gateway at boot. Without this the process starts
  // happily and the first customer to request a code gets a 502.
  .refine(
    (config) =>
      config.SMS_PROVIDER !== "kavenegar" || Boolean(config.KAVENEGAR_API_KEY),
    {
      path: ["KAVENEGAR_API_KEY"],
      message: "KAVENEGAR_API_KEY is required when SMS_PROVIDER=kavenegar",
    },
  )
  // One of the two spellings has to be present. Enforced here rather than with
  // .min(1) on either field, since either alone satisfies the requirement.
  .refine((config) => Boolean(config.MONGO_URI ?? config.MONGODB_URI), {
    path: ["MONGO_URI"],
    message: "MONGO_URI is required (MONGODB_URI is accepted as an alias)",
  })
  // Same, for the origin allowlist. Defaulted rather than required, because
  // local dev and the Docker stack both sit on http://localhost:3000.
  .refine(
    (config) =>
      config.NODE_ENV !== "production" ||
      Boolean(config.ALLOWED_ORIGIN ?? config.CORS_ORIGIN),
    {
      path: ["ALLOWED_ORIGIN"],
      message:
        "ALLOWED_ORIGIN is required in production -- name the deployed " +
        "frontend origin exactly, e.g. https://g-dash.vercel.app",
    },
  )
  // Cloudinary is all-or-nothing. Two of three is a deployment that will fail
  // on its first upload rather than at boot.
  .refine(
    (config) => {
      const parts = [
        config.CLOUDINARY_CLOUD_NAME,
        config.CLOUDINARY_API_KEY,
        config.CLOUDINARY_API_SECRET,
      ].filter(Boolean).length;
      return parts === 0 || parts === 3;
    },
    {
      path: ["CLOUDINARY_CLOUD_NAME"],
      message:
        "Set all three CLOUDINARY_* variables or none of them",
    },
  );

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  console.error("\nCopy .env.example to .env and fill in the values.");
  process.exit(1);
}

const isProduction = parsed.data.NODE_ENV === "production";

/**
 * Which gateway to use, resolved rather than defaulted in the schema.
 *
 * An explicit SMS_PROVIDER always wins. Otherwise the presence of a Kavenegar
 * key is the signal: a deployment that has credentials means to use them, and
 * one that does not would only fail on the first login if we assumed otherwise.
 *
 * `console` is the previous name for the mock and is folded into it here, so
 * existing .env files keep working.
 */
const smsProvider: "mock" | "kavenegar" =
  parsed.data.SMS_PROVIDER === "kavenegar"
    ? "kavenegar"
    : parsed.data.SMS_PROVIDER === "mock" || parsed.data.SMS_PROVIDER === "console"
      ? "mock"
      : parsed.data.KAVENEGAR_API_KEY
        ? "kavenegar"
        : "mock";

export const env = {
  ...parsed.data,
  SMS_PROVIDER: smsProvider,
  /** True when no real SMS leaves the process. Drives the dev-only fields. */
  smsIsMock: smsProvider === "mock",
  isProduction,

  /** Whichever spelling was supplied. The refinement guarantees one exists. */
  MONGO_URI: (parsed.data.MONGO_URI ?? parsed.data.MONGODB_URI)!,

  /**
   * Origins CORS will echo back, in the order they were listed.
   *
   * A list rather than a single value because a real deployment usually has
   * more than one legitimate frontend: the production domain plus Vercel's
   * per-branch preview URLs, or the old domain during a cutover.
   */
  allowedOrigins: (
    parsed.data.ALLOWED_ORIGIN ??
    parsed.data.CORS_ORIGIN ??
    "http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.replace(/\/+$/, "").trim())
    .filter(Boolean),

  // Secure cookies require HTTPS, which breaks plain-http local dev.
  cookieSecure: isProduction,

  /**
   * `none` in production so the cookie survives a cross-site request.
   *
   * The frontend and the API are on different registrable domains there
   * (Vercel and Render), which makes every API call cross-site; `lax` would
   * have the browser withhold the cookie and every authenticated request would
   * answer 401. `none` is only honoured alongside `Secure`, which is why it is
   * tied to the same NODE_ENV check as `cookieSecure` rather than being its own
   * switch -- the two cannot legally disagree.
   *
   * Local dev and the Docker stack stay on `lax`: same-site there, and `none`
   * over plain http is rejected by the browser outright.
   */
  cookieSameSite: (isProduction ? "none" : "lax") as "none" | "lax",
};
