import type { Request, RequestHandler } from "express";
import { HttpError } from "./error-handler.js";
import {
  COOKIE_NAMES,
  verifyToken,
  type Role,
  type TokenPayload,
} from "../services/token.service.js";

/**
 * Authentication is split in two, so that "who is this?" and "are they allowed?"
 * are separate concerns:
 *
 *   authenticate      -- reads and verifies the JWT cookies, attaches req.user.
 *                        Never rejects. A request with no cookie is simply
 *                        anonymous, which is a valid state for public routes.
 *   requireRole(role) -- rejects unless a valid session for `role` is present.
 *
 * They compose: `app.use(authenticate)` once, then `requireRole("admin")` on
 * the groups that need it.
 */

/** Verifies every role cookie present on the request. */
function readSessions(req: Request): Partial<Record<Role, TokenPayload>> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const sessions: Partial<Record<Role, TokenPayload>> = {};

  for (const role of Object.keys(COOKIE_NAMES) as Role[]) {
    const payload = verifyToken(cookies[COOKIE_NAMES[role]]);
    // Guard against a token whose payload role disagrees with the cookie it
    // arrived in -- that would let a customer token sit in the admin cookie.
    if (payload && payload.role === role) {
      sessions[role] = payload;
    }
  }

  return sessions;
}

/**
 * Reads the JWT cookies, verifies them, and attaches the result.
 *
 * An invalid, expired or forged token is treated exactly like no token at all:
 * the request continues as anonymous and whatever guard sits downstream decides
 * the outcome. Rejecting here would turn an expired cookie into a hard 401 on
 * public routes, which is wrong -- the login page must stay reachable.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const sessions = readSessions(req);
  req.sessions = sessions;
  // Default principal when a route doesn't name a role. Admin wins because
  // staff routes are the stricter context.
  req.user = sessions.admin ?? sessions.customer;
  next();
};

/**
 * Rejects unless the request carries a valid session for `role`, then repoints
 * `req.user` at that principal so the handler sees the role it asked for.
 *
 * Requires `authenticate` to have run first.
 */
export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    const session = req.sessions?.[role];

    if (!session) {
      // 401 when nothing is signed in, 403 when someone is but as the wrong
      // role -- re-authenticating fixes the first, never the second.
      const anySession = req.user !== undefined;
      return next(
        anySession
          ? new HttpError(403, `This endpoint requires the ${role} role`)
          : new HttpError(401, "Authentication required"),
      );
    }

    req.user = session;
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireCustomer = requireRole("customer");

/** True when a valid session for `role` is on the request. */
export function hasRole(req: Request, role: Role): boolean {
  return req.sessions?.[role] !== undefined;
}
