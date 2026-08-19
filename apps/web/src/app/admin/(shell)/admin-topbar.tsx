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

export function AdminTopBar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const setAnonymous = useAuthStore((s) => s.setAnonymous);
  const reset = useAuthStore((s) => s.reset);

  const { data, isPending, isError } = useQuery({
    queryKey: adminMeKey,
    queryFn: fetchAdminMe,
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (data) setUser(toAuthUser(data));
    else if (isError) setAnonymous();
  }, [data, isError, setUser, setAnonymous]);

  useEffect(() => {
    if (isError) router.replace(ROUTES.adminLogin);
  }, [isError, router]);

  const logout = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      reset();
      queryClient.clear();

      router.replace(ROUTES.adminLogin);
      router.refresh();
    },
    onError: (error) => {
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
        <SidebarMenuButton className="-ms-2" />
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised text-sm font-medium text-fg-secondary"
        >
          {username?.[0]?.toUpperCase() ?? "‌"}
        </span>

        <div className="flex min-w-0 flex-col">
          {isPending ? (
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
