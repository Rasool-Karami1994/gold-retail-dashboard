import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not catch rejections from async handlers -- they surface as
 * unhandled rejections and the request hangs. Wrap async controllers with this
 * so they reach the error middleware.
 *
 * (Express 5 handles this natively; drop this when upgrading.)
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
