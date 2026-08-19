import { jwtVerify } from "jose";
import { COOKIE_NAMES, type Role } from "@/config/routes";

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

export function cookieNameFor(role: Role): string {
  return COOKIE_NAMES[role];
}
