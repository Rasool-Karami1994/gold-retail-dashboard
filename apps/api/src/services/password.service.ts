import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.HOaMTIkcOtHtdIsp5UnUKMBGRZLxFTe";

export function burnPasswordComparison(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}
