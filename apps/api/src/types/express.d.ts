import type { TokenPayload, Role } from "../services/token.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      sessions?: Partial<Record<Role, TokenPayload>>;
    }
  }
}

export {};
