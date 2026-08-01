import type { Request, RequestHandler } from "express";
import { HttpError } from "./error-handler.js";
import { COOKIE_NAMES, verifyToken, type Role, type TokenPayload } from "../services/token.service.js";

/**
 * Reads the session cookie for a role and verifies it.
 *
 * The authenticated principal goes on `res.locals.auth` rather than being
 * bolted onto `req`, matching how `validate()` uses res.locals and avoiding a
 * global Express type augmentation.
 */

function readToken(req: Request, role: Role): TokenPayload | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return verifyToken(cookies?.[COOKIE_NAMES[role]]);
}

/** 401s unless a valid token for `role` is present. */
export function requireAuth(role: Role): RequestHandler {
  return (req, res, next) => {
    const auth = readToken(req, role);
    if (!auth) {
      return next(new HttpError(401, "Authentication required"));
    }
    res.locals.auth = auth;
    next();
  };
}

export const requireAdmin = requireAuth("admin");
export const requireCustomer = requireAuth("customer");

/**
 * Attaches the principal when present but never rejects.
 *
 * Used by request-otp, where the rule depends on the body: `purpose: 'login'`
 * is public, `purpose: 'register'` is admin-only. The branch can only be
 * decided after validation, so authentication has to be non-fatal here and
 * enforced in the controller.
 */
export function attachAuthIfPresent(role: Role): RequestHandler {
  return (req, res, next) => {
    const auth = readToken(req, role);
    if (auth) res.locals.auth = auth;
    next();
  };
}

/** Typed reader for whatever the middleware above attached. */
export function currentAuth(res: { locals: Record<string, unknown> }): TokenPayload | null {
  return (res.locals.auth as TokenPayload | undefined) ?? null;
}
