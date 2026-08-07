import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { adminAuthRouter } from "./routes/admin-auth.routes.js";
import { adminCustomerRouter } from "./routes/admin-customer.routes.js";
import { adminStatsRouter } from "./routes/admin-stats.routes.js";
import { adminTransactionRouter } from "./routes/admin-transaction.routes.js";
import { customerAuthRouter } from "./routes/customer-auth.routes.js";
import { customerMeRouter } from "./routes/customer-me.routes.js";
import { customerTransactionRouter } from "./routes/customer-transaction.routes.js";
import { invoiceRouter } from "./routes/invoice.routes.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy this makes req.ip and rate limiting see the real
  // client address instead of the proxy's.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  // `credentials: true` is required for the browser to send and receive the
  // httpOnly auth cookies. It also forbids `origin: "*"` -- the spec rejects a
  // wildcard on a credentialed request -- so the allowlist has to be explicit,
  // which is what ALLOWED_ORIGIN is for.
  app.use(
    cors({
      origin: env.allowedOrigins,
      credentials: true,
    }),
  );
  app.use(morgan(env.LOG_FORMAT));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Identify the caller on every request. This never rejects -- it only
  // populates req.user / req.sessions. Route groups decide what to require via
  // requireRole(), so public routes stay reachable with an expired cookie.
  app.use(authenticate);

  // Auth sits at /api/* per the specified route shape; the resource API stays
  // versioned under /api/v1.
  app.use("/api/admin/auth", adminAuthRouter);
  app.use("/api/admin/customers", adminCustomerRouter);
  app.use("/api/admin/stats", adminStatsRouter);
  app.use("/api/admin/transactions", adminTransactionRouter);
  app.use("/api/customer/auth", customerAuthRouter);
  app.use("/api/customer/me", customerMeRouter);
  app.use("/api/customer/transactions", customerTransactionRouter);

  // Public on purpose: customers open these from an SMS link with no account.
  // The filename is the credential -- see routes/invoice.routes.ts.
  app.use("/api/invoices", invoiceRouter);
  app.use("/api/v1", apiRouter);

  // Order matters: 404 first, then the error handler that renders it.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
