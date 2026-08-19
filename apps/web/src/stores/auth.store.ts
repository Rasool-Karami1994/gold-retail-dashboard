import { create } from "zustand";
import type { Role } from "@/config/routes";

export interface AuthUser {
  id: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  username?: string;
}

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

export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useAuthStatus = () => useAuthStore((s) => s.status);
export const useUserRole = () => useAuthStore((s) => s.user?.role ?? null);
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === "admin");

export function useDisplayName(): string | null {
  return useAuthStore((s) => {
    if (!s.user) return null;
    const { firstName, lastName, username } = s.user;
    const full = [firstName, lastName].filter(Boolean).join(" ").trim();
    return full || username || null;
  });
}
