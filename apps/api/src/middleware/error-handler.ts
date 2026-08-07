import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env.js";

/** An error with an intended HTTP status. Anything else becomes a 500. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Field-level problems, as the validator produces them: [{ path, message }]. */
    readonly details?: unknown,
    /**
     * Extra facts the client needs to act on the failure, merged into the error
     * body alongside `message`.
     *
     * Separate from `details` because that is a list of field complaints and
     * this is not -- the rejected-payment case has to carry the remaining
     * balance so the form can say what would have fit, and burying a number the
     * UI must render inside a validation array would be the wrong shape.
     */
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Express identifies error middleware by arity, so all four params must stay.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof HttpError
      ? err.message
      : env.isProduction
        ? "Internal server error"
        : ((err as Error)?.message ?? "Internal server error");

  if (status >= 500) {
    console.error("[error]", err);
  }

  res.status(status).json({
    error: {
      message,
      ...(err instanceof HttpError && err.details ? { details: err.details } : {}),
      ...(err instanceof HttpError && err.meta ? err.meta : {}),
      // Stack traces leak file paths and dependency versions; dev only.
      ...(env.isProduction ? {} : { stack: (err as Error)?.stack }),
    },
  });
};
