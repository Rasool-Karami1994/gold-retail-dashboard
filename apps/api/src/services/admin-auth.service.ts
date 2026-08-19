import { AdminModel, type AdminDocument } from "../models/admin.model.js";
import { HttpError } from "../middleware/error-handler.js";
import { burnPasswordComparison, verifyPassword } from "./password.service.js";

export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<AdminDocument> {
  const admin = await AdminModel.findOne({
    username: username.trim().toLowerCase(),
  }).select("+passwordHash");

  if (!admin) {
    await burnPasswordComparison(password);
    throw new HttpError(401, "Invalid username or password");
  }

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid username or password");
  }

  return admin;
}
