import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

/**
 * bcrypt hashing, isolated here so the algorithm and cost factor are changed
 * in one place.
 *
 * NOTE: this uses `bcryptjs`, the pure-JS implementation, rather than the
 * native `bcrypt` package. The hashes are the same standard `$2b$` format and
 * are interchangeable between the two; bcryptjs just avoids a node-gyp build
 * step, which matters on Windows and in slim containers. It is roughly 30%
 * slower to hash, which is irrelevant at login frequency.
 */

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A hash of a throwaway value, used to burn the same ~250ms when a username
 * doesn't exist as when it does. Without this, "user not found" returns in
 * microseconds and "wrong password" in a quarter second, which is a reliable
 * account-enumeration oracle regardless of what the response body says.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.HOaMTIkcOtHtdIsp5UnUKMBGRZLxFTe";

export function burnPasswordComparison(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}
