"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SidebarMenuButton, toast } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { ApiError } from "@/lib/api";
import {
  adminMeKey,
  fetchAdminMe,
  logoutAdmin,
  toAuthUser,
} from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Top bar for the admin shell: who is signed in, and the way out.
 *
 * The session is fetched here rather than read from the store alone. The auth
 * store is deliberately not persisted (see auth.store.ts), so after a reload it
 * is empty and the bar would render a blank name -- `/me` is the only thing
 * that can answer the question, and the httpOnly cookie makes it cheap.
 */
export function AdminTopBar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const setAnonymous = useAuthStore((s) => s.setAnonymous);
  const reset = useAuthStore((s) => s.reset);

  const { data, isPending, isError } = useQuery({
    queryKey: adminMeKey,
    queryFn: fetchAdminMe,
    // The middleware already gated this route, so a 401 here means the cookie
    // died mid-session. Don't retry it -- the effect below sends them to login.
    retry: false,
    staleTime: 5 * 60_000,
  });

  // Mirror the answer into the store so anything else in the shell can read the
  // current admin without repeating the request.
  useEffect(() => {
    if (data) setUser(toAuthUser(data));
    else if (isError) setAnonymous();
  }, [data, isError, setUser, setAnonymous]);

  // A session that expired while the tab sat open: the middleware only runs on
  // navigation, so nothing else would notice until the next click.
  useEffect(() => {
    if (isError) router.replace(ROUTES.adminLogin);
  }, [isError, router]);

  const logout = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      reset();
      // Drop every cached response. Without this, signing in as a different
      // admin on the same browser would paint the previous one's customers and
      // invoices from cache before any refetch lands.
      queryClient.clear();

      router.replace(ROUTES.adminLogin);
      // The cookie is gone as of this response; refresh so the middleware
      // re-evaluates with it absent.
      router.refresh();
    },
    onError: (error) => {
      // Deliberately does NOT navigate. The cookie is httpOnly, so if the
      // server never cleared it the session is still live -- bouncing to
      // /admin/login would just be redirected straight back by the middleware,
      // which reads as the button being broken.
      toast.error(
        error instanceof ApiError
          ? "خروج انجام نشد. دوباره تلاش کنید."
          : "اتصال به سرور برقرار نشد.",
      );
    },
  });

  const username = data?.admin.username;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-sunken px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* On mobile the rail is a drawer, so this is the only way into it. */}
        <SidebarMenuButton className="-ms-2" />
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised text-sm font-medium text-fg-secondary"
        >
          {username?.[0]?.toUpperCase() ?? "‌"}
        </span>

        <div className="flex min-w-0 flex-col">
          {isPending ? (
            // Reserve the same height so the bar doesn't jump when the name
            // arrives.
            <span className="h-4 w-24 animate-pulse rounded bg-surface-raised" />
          ) : (
            <span className="truncate text-sm font-medium text-fg">
              {username ?? "—"}
            </span>
          )}
          <span className="text-2xs text-fg-muted">مدیر</span>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        loading={logout.isPending}
        onClick={() => logout.mutate()}
        startIcon={
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Points inline-start (the way out) in RTL. */}
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5M21 12H9" />
          </svg>
        }
      >
        خروج
      </Button>
    </header>
  );
}
