import type { Request, RequestHandler } from "express";
import { HttpError } from "./error-handler.js";
import {
  COOKIE_NAMES,
  verifyToken,
  type Role,
  type TokenPayload,
} from "../services/token.service.js";

function readSessions(req: Request): Partial<Record<Role, TokenPayload>> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const sessions: Partial<Record<Role, TokenPayload>> = {};

  for (const role of Object.keys(COOKIE_NAMES) as Role[]) {
    const payload = verifyToken(cookies[COOKIE_NAMES[role]]);
    if (payload && payload.role === role) {
      sessions[role] = payload;
    }
  }

  return sessions;
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const sessions = readSessions(req);
  req.sessions = sessions;
  req.user = sessions.admin ?? sessions.customer;
  next();
};

export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    const session = req.sessions?.[role];

    if (!session) {
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

export function hasRole(req: Request, role: Role): boolean {
  return req.sessions?.[role] !== undefined;
}
