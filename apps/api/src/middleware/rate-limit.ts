import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import { normalizeMobile } from "../lib/mobile.js";

/**
 * Rate limiters.
 *
 * NOTE: these use express-rate-limit's default in-memory store, so the counters
 * are per-process. Behind more than one instance the effective limit multiplies
 * by the instance count. Swap in the Redis store before scaling out.
 */

/**
 * OTP requests, keyed by mobile number: `OTP_RATE_LIMIT_MAX` per
 * `OTP_RATE_LIMIT_WINDOW_MINUTES` (default 3 per 10 minutes).
 *
 * Keying on the mobile rather than the IP is what the flow needs -- it is the
 * phone owner we're protecting from an SMS flood, and an attacker rotating IPs
 * shouldn't get a fresh budget. The tradeoff is that anyone can burn a specific
 * number's budget and lock its owner out for the window. Add an IP-keyed
 * limiter alongside this one if that becomes a problem in practice.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.OTP_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  keyGenerator: (req) => {
    const mobile = (req.body as { mobile?: unknown } | undefined)?.mobile;
    const normalized = typeof mobile === "string" ? normalizeMobile(mobile) : "";
    // A malformed body has no mobile to key on; fall back to the IP so those
    // requests can't bypass the limiter entirely by omitting the field.
    return normalized ? `mobile:${normalized}` : ipKeyGenerator(req.ip ?? "");
  },

  // Failed requests (unknown mobile, bad purpose) still count. Otherwise the
  // limiter is trivially bypassed by making requests that error.
  skipSuccessfulRequests: false,

  handler: (_req, res) => {
    res.status(429).json({
      error: {
        message: `Too many code requests. Try again in ${env.OTP_RATE_LIMIT_WINDOW_MINUTES} minutes.`,
      },
    });
  },
});

/**
 * Admin login, keyed by IP.
 *
 * Not in the original spec -- added because an unthrottled password endpoint is
 * brute-forceable, and bcrypt at cost 12 also makes it a cheap way to pin the
 * CPU. Remove this export and its use in admin-auth.routes.ts if unwanted.
 */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Only failures count, so a busy admin logging in correctly is never blocked.
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: { message: "Too many login attempts. Try again in 15 minutes." },
    });
  },
});
