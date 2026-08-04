"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Sidebar, toast, type SidebarItem } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { ApiError } from "@/lib/api";
import {
  customerMeKey,
  fetchCustomerMe,
  logoutCustomer,
  toCustomerAuthUser,
} from "@/lib/auth-api";
import { useAuthStore, useCurrentUser, useDisplayName } from "@/stores/auth.store";
import { CUSTOMER_PROFILE, CUSTOMER_TRANSACTIONS } from "./routes";

/**
 * Navigation for the customer area.
 *
 * Two destinations and a way out -- that is the whole product for a customer,
 * so there is no top bar: the name and the logout button live in the rail's
 * footer rather than in a second strip of chrome above content that is mostly
 * one table.
 */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const items: SidebarItem[] = [
  {
    href: CUSTOMER_TRANSACTIONS,
    label: "معاملات من",
    icon: (
      <Icon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </Icon>
    ),
  },
  {
    href: CUSTOMER_PROFILE,
    label: "اطلاعات کاربری",
    icon: (
      <Icon>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </Icon>
    ),
  },
];

export function CustomerSidebar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const setAnonymous = useAuthStore((s) => s.setAnonymous);
  const reset = useAuthStore((s) => s.reset);

  const { data, isPending, isError } = useQuery({
    queryKey: customerMeKey,
    queryFn: fetchCustomerMe,
    // The middleware already gated this area, so a 401 here means the cookie
    // died mid-session. Don't retry -- the effect below sends them to sign-in.
    retry: false,
    staleTime: 5 * 60_000,
  });

  // Mirror the answer into the store, which is what this footer actually
  // renders. Going through the store rather than straight from `data` is what
  // lets the profile form's save show up here immediately -- it writes the new
  // name to the store, and this re-renders without waiting for a refetch.
  useEffect(() => {
    if (data) setUser(toCustomerAuthUser(data));
    else if (isError) setAnonymous();
  }, [data, isError, setUser, setAnonymous]);

  // A session that expired while the tab sat open: the middleware only runs on
  // navigation, so nothing else would notice until the next click.
  useEffect(() => {
    if (isError) router.replace(ROUTES.customerLogin);
  }, [isError, router]);

  // `data` is the fallback for the render between the query resolving and the
  // effect above running, so the name never blinks through a dash.
  const displayName = useDisplayName() ?? data?.fullName ?? null;
  const mobile = useCurrentUser()?.mobile ?? data?.mobile ?? "";

  const logout = useMutation({
    mutationFn: logoutCustomer,
    onSuccess: () => {
      reset();
      // Drop every cached response. Without this, signing in as a different
      // customer on the same browser would paint the previous one's invoices
      // from cache before any refetch lands.
      queryClient.clear();

      router.replace(ROUTES.customerLogin);
      // The cookie is gone as of this response; refresh so the middleware
      // re-evaluates with it absent.
      router.refresh();
    },
    onError: (error) => {
      // Deliberately does NOT navigate. The cookie is httpOnly, so if the
      // server never cleared it the session is still live -- bouncing to the
      // sign-in page would be redirected straight back by the middleware, which
      // reads as the button being broken.
      toast.error(
        error instanceof ApiError
          ? "خروج انجام نشد. دوباره تلاش کنید."
          : "اتصال به سرور برقرار نشد.",
      );
    },
  });

  return (
    <Sidebar
      items={items}
      header={
        <div className="flex flex-col">
          <span className="text-sm font-bold text-fg">جی‌داش</span>
          <span className="text-2xs text-fg-muted">حساب کاربری</span>
        </div>
      }
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised text-sm font-medium text-fg-secondary"
            >
              {displayName?.[0] ?? "‌"}
            </span>

            <div className="flex min-w-0 flex-col">
              {isPending ? (
                <span className="h-4 w-24 animate-pulse rounded bg-surface-raised" />
              ) : (
                <span className="truncate text-sm text-fg">
                  {displayName ?? "—"}
                </span>
              )}
              <span className="text-2xs text-fg-muted" dir="ltr">
                {mobile}
              </span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            fullWidth
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
        </div>
      }
    />
  );
}
