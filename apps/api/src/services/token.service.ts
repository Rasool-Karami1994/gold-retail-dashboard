import jwt, { type SignOptions } from "jsonwebtoken";
import type { Response } from "express";
import { env } from "../config/env.js";

/**
 * JWT issuing and the cookies that carry them.
 *
 * Tokens travel in httpOnly cookies rather than a response body, so page
 * JavaScript -- including anything injected via XSS -- cannot read them.
 *
 * `sameSite: "lax"` in every environment, which keeps the browser's built-in
 * CSRF protection: the cookie is withheld from cross-site POSTs, turning away
 * the common shapes for free.
 *
 * That is only possible because the browser never talks to this API directly.
 * In production the frontend proxies /api/* from its own origin
 * (apps/web/next.config.mjs), so the request arrives here same-site even though
 * the two apps are deployed to different hosts. Calling this API straight from
 * another registrable domain would need `none`, which switches that protection
 * off and leans entirely on the CORS allowlist -- see DEPLOY.md section 6 for
 * why the proxy was preferred.
 *
 * Admin and customer sessions use separate cookie names. One shared cookie
 * would mean a staff member testing the customer view silently destroys their
 * own admin session, and it makes "which role is this request?" ambiguous.
 */

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
    // Env gives us a plain string ("7d"); the typings want a narrower literal.
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

/** Returns the payload, or null if the token is absent, invalid or expired. */
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
    // Malformed, wrong signature, or expired -- all mean "not authenticated".
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
  // Must match the attributes the cookie was set with, or the browser keeps it.
  res.clearCookie(COOKIE_NAMES[role], cookieOptions());
}

/** Minimal "7d" / "12h" / "30m" / "3600" parser for the cookie's maxAge. */
function expiresInMs(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return amount * multiplier;
}
