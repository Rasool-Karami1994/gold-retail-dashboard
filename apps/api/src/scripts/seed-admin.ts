import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { AdminModel } from "../models/admin.model.js";
import { hashPassword } from "../services/password.service.js";

const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const username = env.SEED_ADMIN_USERNAME;
  const password = env.SEED_ADMIN_PASSWORD;
  const force = process.argv.includes("--force");

  if (!username || !password) {
    console.error(
      "SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must both be set.\n" +
        "Add them to apps/api/.env, run this script, then remove them again --\n" +
        "there is no reason for the running server to hold an admin password.",
    );
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
    process.exit(1);
  }

  await connectDatabase();

  const normalized = username.trim().toLowerCase();
  const existing = await AdminModel.findOne({ username: normalized });

  if (existing && !force) {
    console.log(
      `Admin "${normalized}" already exists (id ${existing.id}). Nothing changed.\n` +
        "Re-run with --force to reset its password.",
    );
    await disconnectDatabase();
    return;
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Password reset for admin "${normalized}" (id ${existing.id}).`);
  } else {
    const admin = await AdminModel.create({
      username: normalized,
      passwordHash,
      role: "admin",
    });
    console.log(`Created admin "${normalized}" (id ${admin.id}).`);
  }

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error("Seeding failed:", error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
