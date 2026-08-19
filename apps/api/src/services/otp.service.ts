import { randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";
import { CustomerModel } from "../models/customer.model.js";
import { OtpRequestModel, type OtpPurpose } from "../models/otp-request.model.js";
import { normalizeMobile } from "../lib/mobile.js";
import { getSmsProvider, SmsError, type SmsProvider } from "./sms.js";
import { setAuthCookie } from "./token.service.js";
import type { Response } from "express";

function generateCode(length = env.OTP_LENGTH): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

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
  expiresInSeconds: number;
  devOtpCode?: string;
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

  let delivery: Awaited<ReturnType<SmsProvider["send"]>>;

  try {
    delivery = await getSmsProvider().send({
      to: normalized,
      text: `کد ورود شما: ${code}\nاعتبار: ${minutes} دقیقه`,
      template: "otp",
      variables: { code, minutes: String(minutes) },
    });
  } catch (error) {
    console.error(`[otp] could not send a ${purpose} code to ${normalized}:`, error);
    throw new HttpError(
      502,
      error instanceof SmsError
        ? "Could not send the verification code. Please try again."
        : "Could not send the verification code.",
    );
  }

  return {
    mobile: normalized,
    purpose,
    expiresAt,
    expiresInSeconds: env.OTP_TTL_SECONDS,
    ...(delivery.text ? { devOtpCode: code } : {}),
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
  customer?: { id: string; firstName: string; lastName: string; mobile: string };
}

export async function verifyOtp(
  { mobile, code, purpose }: VerifyOtpInput,
  res: Response,
): Promise<VerifyOtpResult> {
  const normalized = normalizeMobile(mobile);

  const otp = await OtpRequestModel.findOne({
    mobile: normalized,
    purpose,
    verified: false,
  })
    .sort({ createdAt: -1 })
    .select("+code");

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
  otp.verifiedAt = new Date();

  if (purpose === "register") {
    otp.expiresAt = new Date(
      Date.now() + env.REGISTRATION_WINDOW_MINUTES * 60 * 1000,
    );
  }

  await otp.save();

  if (purpose === "register") {
    return { verified: true, mobile: normalized, purpose };
  }

  const customer = await CustomerModel.findOne({ mobile: normalized });
  if (!customer) {
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
