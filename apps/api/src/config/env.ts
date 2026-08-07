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
   * Deliberately run the MOCK gateway in production. Off unless it says "true".
   *
   * READ THIS BEFORE SETTING IT. The mock delivers nothing and returns the
   * one-time code in the API response, which the sign-in form then displays.
   * With it on, anyone who knows a customer's mobile number can request a code,
   * read it off their own screen, and sign in as that customer. OTP stops being
   * authentication and becomes decoration.
   *
   * It exists because a launch without gateway credentials is a real situation
   * -- a demo, or the window before Kavenegar approves the template -- and the
   * alternative people reach for is worse: quietly defaulting to mock, shipping
   * that hole, and not knowing. Making it an explicit variable is the
   * difference between "we accepted this for the demo" and "we forgot".
   *
   * Unset it the moment KAVENEGAR_API_KEY arrives.
   */
  ALLOW_MOCK_SMS_IN_PRODUCTION: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),

  /**
   * Public origin of this API, used to build the absolute invoice URL that
   * goes out by SMS. Must be reachable from a customer's phone -- localhost
   * is fine in dev and wrong everywhere else.
   */
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),

  /**
   * Path to a Chrome/Chromium binary for PDF rendering.
   *
   * PUPPETEER_EXECUTABLE_PATH is the primary name -- it is what Puppeteer's own
   * docs use, what the Docker image sets, and what Render's Puppeteer recipe
   * tells you to configure. CHROME_EXECUTABLE_PATH is this repo's older name
   * and is still honoured, so existing .env files keep working.
   *
   * Leave both unset to auto-detect: services/invoice.ts scans the Puppeteer
   * browser cache and then the usual system install locations.
   */
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  CHROME_EXECUTABLE_PATH: z.string().optional(),

  /**
   * Where `npx puppeteer browsers install chrome` put its download.
   *
   * Only needed when it is not the default (~/.cache/puppeteer). On Render it
   * usually is: the build cache is the only thing that survives to run time, so
   * the documented recipe points this at a directory inside the project.
   */
  PUPPETEER_CACHE_DIR: z.string().optional(),

  /**
   * Adds --single-process to the Chromium launch args. Default OFF.
   *
   * The flag saves the most memory of anything available and breaks PDF
   * rendering outright -- `Page.printToPDF` needs a compositor process that
   * single-process mode does not provide, so every invoice fails with
   * "Target closed". See LAUNCH_ARGS in services/invoice.ts. Exposed only so
   * the result can be reproduced on another host without editing code.
   */
  PUPPETEER_SINGLE_PROCESS: z
    .preprocess((value) => value === "true" || value === "1", z.boolean())
    .default(false),

  /**
   * Cloudinary credentials. THE ONLY STORAGE FOR RENDERED INVOICES.
   *
   * There is no local-disk path any more: Render's filesystem is ephemeral, so
   * a PDF written there vanishes on the next deploy while `invoicePdfUrl` goes
   * on pointing at it. services/invoice.ts uploads the buffer instead.
   *
   * Optional at the schema level so `pnpm dev` works without an account -- the
   * refinement below makes all three mandatory in production, and locally a
   * missing set fails the render (recoverable) rather than the boot.
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
  // Cloudinary is all-or-nothing, and mandatory in production -- it is the only
  // place invoices are stored. A partial set would boot happily and then fail
  // on the first upload, which is a sale already recorded with no invoice.
  .refine(
    (config) => {
      const parts = [
        config.CLOUDINARY_CLOUD_NAME,
        config.CLOUDINARY_API_KEY,
        config.CLOUDINARY_API_SECRET,
      ].filter(Boolean).length;
      return config.NODE_ENV === "production" ? parts === 3 : parts === 0 || parts === 3;
    },
    {
      path: ["CLOUDINARY_CLOUD_NAME"],
      message:
        "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET " +
        "are all required in production -- invoices have no other storage. " +
        "Outside production, set all three or none.",
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

/**
 * Decide the mock-in-production question HERE, at boot, not at the first login.
 *
 * MockSmsProvider also refuses to construct in production, but it is built
 * lazily -- the first time someone requests a code. That is far too late: the
 * deploy goes green, the health check passes, and the fault surfaces days later
 * as a customer who cannot sign in. Render's logs show a 502 on an OTP route
 * and nothing that explains it.
 *
 * Checked against the RESOLVED provider rather than the raw env var, so the
 * "no SMS_PROVIDER and no Kavenegar key" case -- the easiest one to deploy by
 * accident -- is caught along with an explicit SMS_PROVIDER=mock.
 */
if (isProduction && smsProvider === "mock") {
  if (!parsed.data.ALLOW_MOCK_SMS_IN_PRODUCTION) {
    console.error(
      [
        "",
        "NODE_ENV=production but no SMS gateway is configured.",
        "",
        "Customer sign-in is OTP-only, so the API would start, pass its health",
        "check, and then fail every login. Refusing to start instead.",
        "",
        "Fix it one of two ways:",
        "",
        "  1. Real gateway (do this before real customers):",
        "       SMS_PROVIDER=kavenegar",
        "       KAVENEGAR_API_KEY=<key>",
        "       KAVENEGAR_SENDER=<line>",
        "",
        "  2. Demo without a gateway, ACCEPTING that one-time codes are",
        "     returned in API responses and anyone who knows a customer's",
        "     number can sign in as them:",
        "       ALLOW_MOCK_SMS_IN_PRODUCTION=true",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  // Opted in. Say so on every boot -- this is the state you forget you are in.
  console.warn(
    [
      "",
      "############################################################",
      "#  MOCK SMS IS ACTIVE IN PRODUCTION                        #",
      "#                                                          #",
      "#  No text messages are being sent. One-time codes are     #",
      "#  returned in API responses, so ANY visitor who knows a   #",
      "#  customer's mobile number can sign in as that customer.  #",
      "#                                                          #",
      "#  Set KAVENEGAR_API_KEY and drop                          #",
      "#  ALLOW_MOCK_SMS_IN_PRODUCTION to close this.             #",
      "############################################################",
      "",
    ].join("\n"),
  );
}

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
   * `lax` everywhere, including production.
   *
   * This was `none` in production, for a deployment where the browser called
   * Render directly and every request was therefore cross-site. It no longer
   * is: next.config.mjs proxies /api/* from the Vercel origin, so the browser
   * only ever talks to one host and the cookie is first-party again.
   *
   * `lax` is the stronger setting and is now sufficient. `none` disables the
   * browser's CSRF protection wholesale -- the cookie rides along on requests
   * initiated by any other site -- and there is no longer anything to buy with
   * it. If the proxy is ever removed in favour of calling the API directly on
   * another registrable domain, this has to go back to `none` and `Secure`, and
   * the middleware guard has to be rethought at the same time.
   */
  cookieSameSite: "lax" as const,
};
