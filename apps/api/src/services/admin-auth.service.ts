import { AdminModel, type AdminDocument } from "../models/admin.model.js";
import { HttpError } from "../middleware/error-handler.js";
import { burnPasswordComparison, verifyPassword } from "./password.service.js";

/**
 * Admin credential checking.
 *
 * Admins are the only accounts with a password; customers authenticate by OTP
 * (see otp.service.ts).
 */

export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<AdminDocument> {
  // passwordHash is `select: false`, so ask for it explicitly.
  const admin = await AdminModel.findOne({
    username: username.trim().toLowerCase(),
  }).select("+passwordHash");

  if (!admin) {
    // Still run a bcrypt comparison so a missing username takes the same time
    // as a wrong password -- otherwise response latency enumerates accounts.
    await burnPasswordComparison(password);
    throw new HttpError(401, "Invalid username or password");
  }

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    // Identical message and status to the branch above: never disclose which
    // half of the credential pair was wrong.
    throw new HttpError(401, "Invalid username or password");
  }

  return admin;
}
