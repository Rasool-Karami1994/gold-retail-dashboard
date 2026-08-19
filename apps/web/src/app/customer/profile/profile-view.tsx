"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Card, CardContent, Input, formatJalali, toast } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  customerMeKey,
  fetchCustomerMe,
  toCustomerAuthUser,
  updateCustomerMe,
  type CustomerMe,
} from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth.store";

const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "نام را وارد کنید")
    .max(60, "نام حداکثر ۶۰ نویسه است"),
  lastName: z
    .string()
    .trim()
    .min(1, "نام خانوادگی را وارد کنید")
    .max(60, "نام خانوادگی حداکثر ۶۰ نویسه است"),
});

type ProfileValues = z.infer<typeof profileSchema>;

function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : null;

  switch (status) {
    case null:
      return "اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";
    case 400:
      return "اطلاعات وارد شده معتبر نیست.";
    case 401:
      return "نشست شما منقضی شده است. دوباره وارد شوید.";
    default:
      return "ذخیره‌ی تغییرات انجام نشد. لطفاً دوباره تلاش کنید.";
  }
}

export function ProfileView() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: customerMeKey,
    queryFn: fetchCustomerMe,
  });

  if (isError) {
    return (
      <Card className="w-full max-w-xl">
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

  if (isPending || !data) return <FormSkeleton />;

  return <ProfileForm key={data.id} customer={data} />;
}

function ProfileForm({ customer }: { customer: CustomerMe }) {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: customer.firstName,
      lastName: customer.lastName,
    },
  });

  const save = useMutation({
    mutationFn: updateCustomerMe,
    onSuccess: (updated) => {
      setUser(toCustomerAuthUser(updated));
      queryClient.setQueryData(customerMeKey, updated);

      reset({ firstName: updated.firstName, lastName: updated.lastName });

      toast.success("اطلاعات شما ذخیره شد");
    },
  });

  return (
    <Card className="w-full max-w-xl">
      <CardContent>
        <form
          noValidate
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="flex flex-col gap-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="نام"
              autoComplete="given-name"
              error={errors.firstName?.message}
              {...register("firstName")}
            />
            <Input
              label="نام خانوادگی"
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...register("lastName")}
            />
          </div>

          <LockedMobile mobile={customer.mobile} />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-fg-muted">عضو از</span>
            <span className="text-sm text-fg-secondary tabular-nums">
              {formatJalali(new Date(customer.createdAt))}
            </span>
          </div>

          {save.error && (
            <p
              role="alert"
              aria-live="polite"
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {messageFor(save.error)}
            </p>
          )}

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button
              type="submit"
              loading={save.isPending}
              disabled={!isDirty}
            >
              ذخیره‌ی تغییرات
            </Button>

            {isDirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  reset();
                  save.reset();
                }}
              >
                انصراف
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LockedMobile({ mobile }: { mobile: string }) {
  const id = React.useId();

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-fg-secondary">
        شماره موبایل
      </label>

      <div className="flex h-11 items-center gap-2 rounded-md border border-dashed border-border bg-surface/40 px-3">
        <input
          id={id}
          value={mobile}
          readOnly
          dir="ltr"
          aria-describedby={`${id}-hint`}
          className="min-w-0 flex-1 cursor-default bg-transparent font-mono text-sm text-fg-muted outline-none"
        />
        <span className="shrink-0 text-fg-disabled" aria-hidden="true">
          <LockIcon />
        </span>
      </div>

      <p id={`${id}-hint`} className="text-xs text-fg-muted">
        شماره موبایل شناسه‌ی ورود شماست و قابل تغییر نیست. برای اصلاح آن به فروشگاه
        مراجعه کنید.
      </p>
    </div>
  );
}

function FormSkeleton() {
  return (
    <Card className="w-full max-w-xl">
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-16 animate-pulse rounded-md bg-surface-raised" />
          <div className="h-16 animate-pulse rounded-md bg-surface-raised" />
        </div>
        <div className="h-16 animate-pulse rounded-md bg-surface-raised" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-surface-raised" />
      </CardContent>
    </Card>
  );
}

function LockIcon() {
  return (
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
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
