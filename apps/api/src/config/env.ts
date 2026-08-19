import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URI: z.string().min(1).optional(),
  MONGODB_URI: z.string().min(1).optional(),

  ALLOWED_ORIGIN: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),

  APP_BASE_URL: z.string().url().optional(),

  LOG_FORMAT: z.string().default("dev"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  COOKIE_DOMAIN: z.string().optional(),

  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(5),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
  OTP_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),

  REGISTRATION_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  SMS_PROVIDER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["mock", "console", "kavenegar"]).optional(),
  ),

  KAVENEGAR_API_KEY: z.string().optional(),
  KAVENEGAR_SENDER: z.string().optional(),

  ALLOW_MOCK_SMS_IN_PRODUCTION: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),

  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),

  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  CHROME_EXECUTABLE_PATH: z.string().optional(),

  PUPPETEER_CACHE_DIR: z.string().optional(),

  PUPPETEER_SINGLE_PROCESS: z
    .preprocess((value) => value === "true" || value === "1", z.boolean())
    .default(false),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  SEED_ADMIN_USERNAME: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
})
  .refine(
    (config) =>
      config.SMS_PROVIDER !== "kavenegar" || Boolean(config.KAVENEGAR_API_KEY),
    {
      path: ["KAVENEGAR_API_KEY"],
      message: "KAVENEGAR_API_KEY is required when SMS_PROVIDER=kavenegar",
    },
  )
  .refine((config) => Boolean(config.MONGO_URI ?? config.MONGODB_URI), {
    path: ["MONGO_URI"],
    message: "MONGO_URI is required (MONGODB_URI is accepted as an alias)",
  })
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

const smsProvider: "mock" | "kavenegar" =
  parsed.data.SMS_PROVIDER === "kavenegar"
    ? "kavenegar"
    : parsed.data.SMS_PROVIDER === "mock" || parsed.data.SMS_PROVIDER === "console"
      ? "mock"
      : parsed.data.KAVENEGAR_API_KEY
        ? "kavenegar"
        : "mock";

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
  smsIsMock: smsProvider === "mock",
  isProduction,

  MONGO_URI: (parsed.data.MONGO_URI ?? parsed.data.MONGODB_URI)!,

  allowedOrigins: (
    parsed.data.ALLOWED_ORIGIN ??
    parsed.data.CORS_ORIGIN ??
    "http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.replace(/\/+$/, "").trim())
    .filter(Boolean),

  cookieSecure: isProduction,

  cookieSameSite: "lax" as const,
};
