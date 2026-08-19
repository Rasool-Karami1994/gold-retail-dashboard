import jwt, { type SignOptions } from "jsonwebtoken";
import type { Response } from "express";
import { env } from "../config/env.js";

export type Role = "admin" | "customer";

export interface TokenPayload {
  id: string;
  role: Role;
}

export const COOKIE_NAMES: Record<Role, string> = {
  admin: "gd_admin_token",
  customer: "gd_customer_token",
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string") return null;

    const { id, role } = decoded as Partial<TokenPayload>;
    if (typeof id !== "string" || (role !== "admin" && role !== "customer")) {
      return null;
    }
    return { id, role };
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookie(res: Response, payload: TokenPayload): string {
  const token = signToken(payload);

  res.cookie(COOKIE_NAMES[payload.role], token, {
    ...cookieOptions(),
    maxAge: expiresInMs(env.JWT_EXPIRES_IN),
  });

  return token;
}

export function clearAuthCookie(res: Response, role: Role): void {
  res.clearCookie(COOKIE_NAMES[role], cookieOptions());
}

function expiresInMs(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return amount * multiplier;
}
