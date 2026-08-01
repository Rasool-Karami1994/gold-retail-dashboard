import { Router } from "express";
import { isDatabaseConnected } from "../config/database.js";

export const healthRouter: Router = Router();

/** Liveness + dependency check. 503 when Mongo is down, so orchestrators notice. */
healthRouter.get("/", (_req, res) => {
  const database = isDatabaseConnected();

  res.status(database ? 200 : 503).json({
    status: database ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dependencies: { database: database ? "up" : "down" },
  });
});
