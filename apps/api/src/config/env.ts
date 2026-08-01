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
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  /** Comma-separated list of origins allowed to call this API. */
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_FORMAT: z.string().default("dev"),

  /* ---- Auth ------------------------------------------------------------ */

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

  /* ---- OTP ------------------------------------------------------------- */

  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(5),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  /** Wrong guesses allowed before a code is burned. */
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Rate limit on request-otp, keyed by mobile. */
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
  OTP_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),

  /** Which SmsProvider implementation to load. See services/sms/index.ts. */
  SMS_PROVIDER: z.enum(["console"]).default("console"),

  /* ---- Seeding --------------------------------------------------------- */

  // Consumed only by `pnpm --filter api seed:admin`, never by the server.
  SEED_ADMIN_USERNAME: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

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

export const env = {
  ...parsed.data,
  isProduction,
  corsOrigins: parsed.data.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Secure cookies require HTTPS, which breaks plain-http local dev.
  cookieSecure: isProduction,
};
