import type { Request, Response } from "express";
import { z } from "zod";
import { OTP_PURPOSES } from "../models/otp-request.model.js";
import { requestOtp, verifyOtp } from "../services/otp.service.js";
import { clearAuthCookie } from "../services/token.service.js";
import { validated } from "../middleware/validate.js";
import { hasRole } from "../middleware/auth.js";
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

function assertPurposeIsPermitted(purpose: string, req: Request) {
  if (purpose !== "register") return;

  if (!hasRole(req, "admin")) {
    throw new HttpError(403, "Registration codes can only be requested by an admin");
  }
}

export async function requestOtpHandler(req: Request, res: Response) {
  const input = validated(res, requestOtpSchema);
  assertPurposeIsPermitted(input.purpose, req);

  const result = await requestOtp(input);

  res.status(201).json(result);
}

export async function verifyOtpHandler(req: Request, res: Response) {
  const input = validated(res, verifyOtpSchema);
  assertPurposeIsPermitted(input.purpose, req);

  res.json(await verifyOtp(input, res));
}

export async function logoutHandler(_req: Request, res: Response) {
  clearAuthCookie(res, "customer");
  res.json({ success: true });
}
