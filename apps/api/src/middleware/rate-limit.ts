import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import { normalizeMobile } from "../lib/mobile.js";

export const otpRequestLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.OTP_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  keyGenerator: (req) => {
    const mobile = (req.body as { mobile?: unknown } | undefined)?.mobile;
    const normalized = typeof mobile === "string" ? normalizeMobile(mobile) : "";
    return normalized ? `mobile:${normalized}` : ipKeyGenerator(req.ip ?? "");
  },

  skipSuccessfulRequests: false,

  handler: (_req, res) => {
    res.status(429).json({
      error: {
        message: `Too many code requests. Try again in ${env.OTP_RATE_LIMIT_WINDOW_MINUTES} minutes.`,
      },
    });
  },
});

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: { message: "Too many login attempts. Try again in 15 minutes." },
    });
  },
});
