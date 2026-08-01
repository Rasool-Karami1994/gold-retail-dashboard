import { randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";
import { CustomerModel } from "../models/customer.model.js";
import { OtpRequestModel, type OtpPurpose } from "../models/otp-request.model.js";
import { normalizeMobile } from "../lib/mobile.js";
import { getSmsProvider } from "./sms/index.js";
import { setAuthCookie } from "./token.service.js";
import type { Response } from "express";

/**
 * One-time-code issuing and verification -- the whole of customer auth.
 *
 * The two purposes have different gates, enforced by the callers:
 *   'login'    -- public. The customer must already exist.
 *   'register' -- admin-only. Reached from the staff "add customer" screen,
 *                 never from the public site. The customer must NOT exist yet.
 */

/** Uniformly random N-digit code, leading zeros allowed. */
function generateCode(length = env.OTP_LENGTH): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

/**
 * Compares in constant time so response latency doesn't leak how many leading
 * digits were right. Length is compared first and separately -- timingSafeEqual
 * throws on a length mismatch, and code length isn't secret anyway.
 */
function codesMatch(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface RequestOtpInput {
  mobile: string;
  purpose: OtpPurpose;
}

export interface RequestOtpResult {
  mobile: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  /** Seconds until the code dies, for the client's countdown. */
  expiresInSeconds: number;
}

export async function requestOtp({
  mobile,
  purpose,
}: RequestOtpInput): Promise<RequestOtpResult> {
  const normalized = normalizeMobile(mobile);
  const exists = await CustomerModel.exists({ mobile: normalized });

  if (purpose === "login" && !exists) {
    throw new HttpError(404, "No customer is registered with this mobile number");
  }
  if (purpose === "register" && exists) {
    throw new HttpError(409, "A customer with this mobile number already exists");
  }

  // Retire any code still outstanding for this mobile+purpose. Without this,
  // every unexpired code stays valid and the attacker's guessing surface grows
  // with each resend.
  await OtpRequestModel.updateMany(
    { mobile: normalized, purpose, verified: false, expiresAt: { $gt: new Date() } },
    { $set: { expiresAt: new Date() } },
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await OtpRequestModel.create({
    mobile: normalized,
    code,
    purpose,
    expiresAt,
  });

  const minutes = Math.round(env.OTP_TTL_SECONDS / 60);
  await getSmsProvider().send({
    to: normalized,
    text: `کد ورود شما: ${code}\nاعتبار: ${minutes} دقیقه`,
    template: "otp",
    variables: { code, minutes: String(minutes) },
  });

  return {
    mobile: normalized,
    purpose,
    expiresAt,
    expiresInSeconds: env.OTP_TTL_SECONDS,
  };
}

export interface VerifyOtpInput {
  mobile: string;
  code: string;
  purpose: OtpPurpose;
}

export interface VerifyOtpResult {
  verified: true;
  mobile: string;
  purpose: OtpPurpose;
  /** Present only for 'login', where a session is established. */
  customer?: { id: string; firstName: string; lastName: string; mobile: string };
}

/**
 * Validates a submitted code and, for 'login', establishes the session by
 * setting the customer cookie on `res`.
 *
 * For 'register' it only marks the code verified and returns -- the Customer
 * document is created by the customers controller, which owns that write.
 */
export async function verifyOtp(
  { mobile, code, purpose }: VerifyOtpInput,
  res: Response,
): Promise<VerifyOtpResult> {
  const normalized = normalizeMobile(mobile);

  // Newest first: a resend supersedes whatever came before it.
  const otp = await OtpRequestModel.findOne({
    mobile: normalized,
    purpose,
    verified: false,
  })
    .sort({ createdAt: -1 })
    .select("+code");

  // The TTL index sweeps roughly once a minute, so an expired document can
  // still be here. Check the timestamp rather than trusting its absence.
  if (!otp || otp.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(400, "This code has expired. Request a new one.");
  }

  if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many incorrect attempts. Request a new code.");
  }

  if (!codesMatch(code, otp.code)) {
    otp.attempts += 1;
    await otp.save();

    const remaining = Math.max(0, env.OTP_MAX_ATTEMPTS - otp.attempts);
    throw new HttpError(
      400,
      remaining > 0
        ? `Incorrect code. ${remaining} attempt(s) remaining.`
        : "Incorrect code. Request a new one.",
    );
  }

  otp.verified = true;
  await otp.save();

  if (purpose === "register") {
    // No session, no customer -- creation happens in the customers controller.
    return { verified: true, mobile: normalized, purpose };
  }

  const customer = await CustomerModel.findOne({ mobile: normalized });
  if (!customer) {
    // Only reachable if the customer was deleted between request and verify.
    throw new HttpError(404, "No customer is registered with this mobile number");
  }

  setAuthCookie(res, { id: customer.id as string, role: "customer" });

  return {
    verified: true,
    mobile: normalized,
    purpose,
    customer: {
      id: customer.id as string,
      firstName: customer.firstName,
      lastName: customer.lastName,
      mobile: customer.mobile,
    },
  };
}
