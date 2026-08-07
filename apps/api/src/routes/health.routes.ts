import { Router } from "express";
import { isDatabaseConnected } from "../config/database.js";

/**
 * TWO HEALTH ENDPOINTS, ON PURPOSE. They answer different questions.
 *
 *   GET /api/health     -- is this process up? Always 200, touches nothing.
 *   GET /api/v1/health  -- is the service usable? 503 while Mongo is down.
 *
 * The split exists because of what polls them. An external uptime pinger hits
 * the free instance every few minutes to keep it from spinning down, and it
 * must be the cheapest response the server can produce: no database round trip
 * on a connection that may itself be cold, and nothing that can turn a keep-
 * alive ping into a 503 and a false alert page.
 *
 * The versioned one stays the real check -- it is what the Docker healthcheck
 * and any orchestrator should use, because "up but cannot reach its database"
 * is exactly the state they need to see.
 */
export const livenessRouter: Router = Router();

livenessRouter.get("/", (_req, res) => {
  // No await anywhere in here. That is the feature.
  res.json({ status: "ok" });
});

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
