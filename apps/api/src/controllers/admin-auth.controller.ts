import type { Request, Response } from "express";
import { z } from "zod";
import { authenticateAdmin } from "../services/admin-auth.service.js";
import { clearAuthCookie, setAuthCookie } from "../services/token.service.js";
import { validated } from "../middleware/validate.js";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

/** POST /api/admin/auth/login */
export async function login(_req: Request, res: Response) {
  const { username, password } = validated(res, loginSchema);
  const admin = await authenticateAdmin(username, password);

  setAuthCookie(res, { id: admin.id as string, role: "admin" });

  // The token is in an httpOnly cookie and deliberately not echoed here.
  res.json({
    admin: { id: admin.id, username: admin.username, role: admin.role },
  });
}

/** POST /api/admin/auth/logout */
export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res, "admin");
  // Unconditionally 200: logging out when already logged out is not an error.
  res.json({ success: true });
}
