import { create } from "zustand";
import type { Role } from "@/config/routes";

/**
 * The signed-in principal, for rendering decisions only.
 *
 * Deliberately NOT persisted. The httpOnly session cookie is the source of
 * truth and this app cannot read it, so anything cached here is a copy that can
 * outlive the real session -- a stale `localStorage` entry would render an
 * admin shell for someone whose token expired an hour ago. Hydrate it from
 * `/me` on mount instead; the middleware and the API remain the real guards.
 */

export interface AuthUser {
  id: string;
  role: Role;
  /** Present for customers. */
  firstName?: string;
  lastName?: string;
  mobile?: string;
  /** Present for admins. */
  username?: string;
}

/**
 * `unknown` is the initial state, before /me has answered. It exists so the
 * shell can show a skeleton rather than flashing a signed-out UI at someone who
 * is in fact signed in.
 */
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  setUser: (user: AuthUser) => void;
  setAnonymous: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "unknown",

  setUser: (user) => set({ user, status: "authenticated" }),
  setAnonymous: () => set({ user: null, status: "anonymous" }),
  reset: () => set({ user: null, status: "unknown" }),
}));

/* Subscribing to a slice rather than the whole store keeps a component from
   re-rendering when an unrelated field changes. */

export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useAuthStatus = () => useAuthStore((s) => s.status);
export const useUserRole = () => useAuthStore((s) => s.user?.role ?? null);
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === "admin");

/** Display name for whichever kind of account is signed in. */
export function useDisplayName(): string | null {
  return useAuthStore((s) => {
    if (!s.user) return null;
    const { firstName, lastName, username } = s.user;
    const full = [firstName, lastName].filter(Boolean).join(" ").trim();
    return full || username || null;
  });
}
