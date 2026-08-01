import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy this makes req.ip and rate limiting see the real
  // client address instead of the proxy's.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(morgan(env.LOG_FORMAT));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/v1", apiRouter);

  // Order matters: 404 first, then the error handler that renders it.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
