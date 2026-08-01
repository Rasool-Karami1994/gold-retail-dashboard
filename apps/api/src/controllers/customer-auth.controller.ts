import type { Request, Response } from "express";
import { z } from "zod";
import { OTP_PURPOSES } from "../models/otp-request.model.js";
import { requestOtp, verifyOtp } from "../services/otp.service.js";
import { clearAuthCookie } from "../services/token.service.js";
import { validated } from "../middleware/validate.js";
import { currentAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { MOBILE_PATTERN, normalizeMobile } from "../lib/mobile.js";
import { env } from "../config/env.js";

const mobileField = z
  .string()
  .transform(normalizeMobile)
  .refine((value) => MOBILE_PATTERN.test(value), {
    message: "Mobile must be a valid Iranian number (09XXXXXXXXX)",
  });

export const requestOtpSchema = z.object({
  mobile: mobileField,
  purpose: z.enum(OTP_PURPOSES),
});

export const verifyOtpSchema = z.object({
  mobile: mobileField,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${env.OTP_LENGTH}}$`), `Code must be ${env.OTP_LENGTH} digits`),
  purpose: z.enum(OTP_PURPOSES),
});

/**
 * `register` codes are issued from the staff "add customer" screen, never by
 * the public site, so they require an admin session. `login` is public.
 *
 * This has to be checked in the controller rather than as route middleware:
 * the rule depends on `purpose`, which isn't known until the body is parsed.
 */
function assertPurposeIsPermitted(purpose: string, res: Response) {
  if (purpose !== "register") return;

  const auth = currentAuth(res);
  if (auth?.role !== "admin") {
    throw new HttpError(403, "Registration codes can only be requested by an admin");
  }
}

/** POST /api/customer/auth/request-otp */
export async function requestOtpHandler(_req: Request, res: Response) {
  const input = validated(res, requestOtpSchema);
  assertPurposeIsPermitted(input.purpose, res);

  const result = await requestOtp(input);

  // The code itself is never in the response -- only the SMS carries it.
  res.status(201).json(result);
}

/** POST /api/customer/auth/verify-otp */
export async function verifyOtpHandler(_req: Request, res: Response) {
  const input = validated(res, verifyOtpSchema);
  assertPurposeIsPermitted(input.purpose, res);

  res.json(await verifyOtp(input, res));
}

/** POST /api/customer/auth/logout */
export async function logoutHandler(_req: Request, res: Response) {
  clearAuthCookie(res, "customer");
  res.json({ success: true });
}
