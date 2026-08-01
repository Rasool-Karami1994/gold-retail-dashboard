import type { TokenPayload, Role } from "../services/token.service.js";

/**
 * Adds the authenticated principal to Express's Request.
 *
 * `user` is the principal a handler should act as. `sessions` holds every valid
 * session on the request -- admin and customer sessions ride in separate
 * cookies, so a staff member with the customer view open legitimately has both.
 * `requireRole()` repoints `user` at the role the route asked for.
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      sessions?: Partial<Record<Role, TokenPayload>>;
    }
  }
}

export {};
