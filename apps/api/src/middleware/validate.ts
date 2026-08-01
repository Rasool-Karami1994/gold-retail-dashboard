import type { RequestHandler, Response } from "express";
import type { ZodTypeAny, z } from "zod";
import { HttpError } from "./error-handler.js";

type Source = "body" | "query" | "params";

/**
 * Parses one part of the request against a Zod schema, or 400s with per-field
 * details.
 *
 * The parsed value goes on `res.locals.validated` rather than back onto the
 * request: in Express 4 `req.query` is a prototype getter with no setter, so
 * assigning to it throws under ESM's strict mode.
 */
export function validate(
  schema: ZodTypeAny,
  source: Source = "body",
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        new HttpError(
          400,
          "Validation failed",
          result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
    }

    res.locals.validated = result.data;
    next();
  };
}

/** Typed accessor for whatever `validate()` most recently parsed. */
export function validated<S extends ZodTypeAny>(res: Response, _schema: S): z.infer<S> {
  return res.locals.validated as z.infer<S>;
}
