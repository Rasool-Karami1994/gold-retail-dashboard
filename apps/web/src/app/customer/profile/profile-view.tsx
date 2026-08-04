"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, formatJalali } from "@/components/ui";
import { customerMeKey, fetchCustomerMe } from "@/lib/auth-api";

/**
 * The customer's own record, read-only.
 *
 * `PATCH /api/customer/me` exists and would let them correct their own name,
 * but editing was not asked for and a half-built form is worse than none.
 * The mobile could not be edited here regardless: it is the login identity, and
 * the API refuses to change it.
 */
export function ProfileView() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: customerMeKey,
    queryFn: fetchCustomerMe,
  });

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-fg-secondary">اطلاعات شما بارگذاری نشد.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-link hover:underline"
          >
            تلاش دوباره
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field label="نام" value={data?.firstName} loading={isPending} />
          <Field label="نام خانوادگی" value={data?.lastName} loading={isPending} />

          <Field
            label="شماره موبایل"
            value={data?.mobile}
            loading={isPending}
            mono
            hint="شماره موبایل شناسه‌ی ورود شماست و قابل تغییر نیست."
          />

          <Field
            label="عضو از"
            value={data ? formatJalali(new Date(data.createdAt)) : undefined}
            loading={isPending}
          />
        </dl>

        <p className="mt-6 rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-fg-muted">
          برای اصلاح اطلاعات، لطفاً به فروشگاه مراجعه کنید.
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  loading,
  mono,
  hint,
}: {
  label: string;
  value?: string;
  loading: boolean;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd>
        {loading ? (
          <span className="block h-5 w-32 animate-pulse rounded bg-surface-raised" />
        ) : (
          <span
            className={mono ? "font-mono text-sm text-fg" : "text-sm text-fg"}
            dir={mono ? "ltr" : undefined}
          >
            {value ?? "—"}
          </span>
        )}
        {hint && <span className="mt-1 block text-2xs text-fg-muted">{hint}</span>}
      </dd>
    </div>
  );
}
