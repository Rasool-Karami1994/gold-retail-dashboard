import type { Request, Response } from "express";
import { z } from "zod";
import { authenticateAdmin } from "../services/admin-auth.service.js";
import { clearAuthCookie, setAuthCookie } from "../services/token.service.js";
import { validated } from "../middleware/validate.js";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function login(_req: Request, res: Response) {
  const { username, password } = validated(res, loginSchema);
  const admin = await authenticateAdmin(username, password);

  setAuthCookie(res, { id: admin.id as string, role: "admin" });

  res.json({
    admin: { id: admin.id, username: admin.username, role: admin.role },
  });
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res, "admin");
  res.json({ success: true });
}
