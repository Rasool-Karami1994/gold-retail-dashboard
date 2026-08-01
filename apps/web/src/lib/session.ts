import { jwtVerify } from "jose";
import { COOKIE_NAMES, type Role } from "@/config/routes";

/**
 * Reads the session cookies the API issues.
 *
 * Verification happens here rather than by calling the API's /me endpoint,
 * because middleware runs on every navigation and a network round trip per
 * request is a latency cost the guard doesn't need to pay. The tradeoff is
 * that this app must hold the same JWT_SECRET as the API.
 *
 * `jose` is used instead of `jsonwebtoken` because Next middleware runs on the
 * Edge runtime, which has Web Crypto but not Node's `crypto` module.
 */

export interface Session {
  id: string;
  role: Role;
}

let cachedSecret: Uint8Array | null = null;
let warnedAboutMissingSecret = false;

function getSecret(): Uint8Array | null {
  const raw = process.env.JWT_SECRET;

  if (!raw || raw.length < 32) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.error(
        "[auth] JWT_SECRET is missing or too short. Every request will be " +
          "treated as signed out. Set it to the same value as apps/api.",
      );
    }
    return null;
  }

  cachedSecret ??= new TextEncoder().encode(raw);
  return cachedSecret;
}

/**
 * Verifies one role's cookie.
 *
 * Fails closed: a missing secret, a bad signature, an expired token or a
 * payload whose role disagrees with the cookie it arrived in all return null.
 * The caller cannot tell those apart, and shouldn't -- they all mean
 * "not signed in as this role".
 */
export async function readSession(
  token: string | undefined,
  role: Role,
): Promise<Session | null> {
  if (!token) return null;

  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret);

    const id = payload.id;
    const tokenRole = payload.role;

    if (typeof id !== "string" || tokenRole !== role) return null;

    return { id, role };
  } catch {
    return null;
  }
}

/** Convenience wrapper for the cookie name belonging to `role`. */
export function cookieNameFor(role: Role): string {
  return COOKIE_NAMES[role];
}
