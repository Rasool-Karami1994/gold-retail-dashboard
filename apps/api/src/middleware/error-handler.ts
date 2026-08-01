import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env.js";

/** An error with an intended HTTP status. Anything else becomes a 500. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
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
      // Stack traces leak file paths and dependency versions; dev only.
      ...(env.isProduction ? {} : { stack: (err as Error)?.stack }),
    },
  });
};
