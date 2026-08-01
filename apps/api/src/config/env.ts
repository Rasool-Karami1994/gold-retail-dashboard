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

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  corsOrigins: parsed.data.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
