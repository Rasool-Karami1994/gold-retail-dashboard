import { Router } from "express";
import { isDatabaseConnected } from "../config/database.js";

export const livenessRouter: Router = Router();

livenessRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

export const healthRouter: Router = Router();

healthRouter.get("/", (_req, res) => {
  const database = isDatabaseConnected();

  res.status(database ? 200 : 503).json({
    status: database ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dependencies: { database: database ? "up" : "down" },
  });
});
