"use client";

import { useQuery } from "@tanstack/react-query";
import { adminMeKey, fetchAdminMe } from "@/lib/auth-api";

/**
 * Says out loud that no real SMS is leaving the API.
 *
 * Reads the same `adminMeKey` query the top bar already runs, so this costs no
 * extra request -- TanStack serves it from cache and the banner just renders a
 * field of an answer the shell needed anyway.
 *
 * Two severities, because the same underlying state means different things:
 *
 *   development  routine. Nobody has a gateway locally, and a red alarm on
 *                every page would be tuned out within a day.
 *   production   `insecureOtp`. Codes are coming back in API responses, so
 *                anyone who knows a customer's mobile can sign in as them. The
 *                API refuses to boot in this state unless someone deliberately
 *                set ALLOW_MOCK_SMS_IN_PRODUCTION, so reaching here means it
 *                was a choice -- and choices like this get forgotten.
 *
 * Renders nothing when SMS is real, which is the normal case in production.
 */
export function SmsModeBanner() {
  const { data } = useQuery({
    queryKey: adminMeKey,
    queryFn: fetchAdminMe,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (!data?.smsMock) return null;

  if (data.insecureOtp) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-danger/40 bg-danger/12 px-4 py-2 text-xs text-danger sm:px-6"
      >
        <WarningIcon />
        <span className="font-bold">پیامک واقعی ارسال نمی‌شود.</span>
        <span className="text-fg-secondary">
          کد ورود در پاسخ سرور برمی‌گردد؛ هرکس شماره‌ی یک مشتری را بداند
          می‌تواند به حساب او وارد شود. پیش از استفاده‌ی مشتریان واقعی،
          درگاه پیامک را فعال کنید.
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning sm:px-6"
    >
      <WarningIcon />
      <span className="font-medium">حالت آزمایشی پیامک</span>
      <span className="text-fg-secondary">
        پیامکی ارسال نمی‌شود و کد تأیید روی صفحه نمایش داده می‌شود.
      </span>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
