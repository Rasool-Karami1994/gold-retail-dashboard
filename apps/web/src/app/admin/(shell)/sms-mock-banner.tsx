"use client";

import { useQuery } from "@tanstack/react-query";
import { adminMeKey, fetchAdminMe } from "@/lib/auth-api";

/**
 * Standing warning that no real SMS is leaving the server.
 *
 * Without it the app looks exactly like the live product: codes appear, flows
 * complete, invoices "send". Someone would reasonably conclude customers are
 * being texted, and only find out otherwise when one says they never got
 * anything.
 *
 * Reads the answer the shell's /me query already has, so this costs no extra
 * request -- and renders nothing at all under a real gateway rather than a
 * cleared or collapsed element, so it cannot be mistaken for a live banner that
 * merely failed to show.
 */
export function SmsMockBanner() {
  const { data } = useQuery({
    queryKey: adminMeKey,
    queryFn: fetchAdminMe,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (!data?.smsMock) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 border-b border-warning/40 bg-warning/12 px-4 py-1.5 text-center text-2xs text-warning"
    >
      <svg
        className="size-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 9v4m0 4h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      حالت آزمایشی: پیامک واقعی ارسال نمی‌شود
    </div>
  );
}
