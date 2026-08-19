import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { adminAuthRouter } from "./routes/admin-auth.routes.js";
import { adminCustomerRouter } from "./routes/admin-customer.routes.js";
import {
  adminCapitalRouter,
  adminGoldPriceRouter,
  adminShopSettingsRouter,
} from "./routes/admin-capital.routes.js";
import { adminStatsRouter } from "./routes/admin-stats.routes.js";
import { adminTransactionRouter } from "./routes/admin-transaction.routes.js";
import { customerAuthRouter } from "./routes/customer-auth.routes.js";
import { customerMeRouter } from "./routes/customer-me.routes.js";
import { customerTransactionRouter } from "./routes/customer-transaction.routes.js";
import { livenessRouter } from "./routes/health.routes.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.allowedOrigins,
      credentials: true,
    }),
  );
  app.use(morgan(env.LOG_FORMAT));

  app.use("/api/health", livenessRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(authenticate);

  app.use("/api/admin/auth", adminAuthRouter);
  app.use("/api/admin/customers", adminCustomerRouter);
  app.use("/api/admin/stats", adminStatsRouter);
  app.use("/api/admin/shop-settings", adminShopSettingsRouter);
  app.use("/api/admin/gold-prices", adminGoldPriceRouter);
  app.use("/api/admin/capital", adminCapitalRouter);
  app.use("/api/admin/transactions", adminTransactionRouter);
  app.use("/api/customer/auth", customerAuthRouter);
  app.use("/api/customer/me", customerMeRouter);
  app.use("/api/customer/transactions", customerTransactionRouter);

  app.use("/api/v1", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
