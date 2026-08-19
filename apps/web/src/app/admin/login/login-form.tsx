"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { RETURN_TO_PARAM, ROUTES } from "@/config/routes";
import { ApiError } from "@/lib/api";
import { loginAdmin, toAuthUser } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth.store";

const loginSchema = z.object({
  username: z.string().trim().min(1, "نام کاربری را وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

type LoginValues = z.infer<typeof loginSchema>;

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";
  }

  switch (error.status) {
    case 400:
      return "اطلاعات وارد شده معتبر نیست.";
    case 401:
      return "نام کاربری یا رمز عبور اشتباه است.";
    case 429:
      return "تلاش‌های ناموفق بیش از حد مجاز. کمی بعد دوباره تلاش کنید.";
    default:
      return error.status >= 500
        ? "خطای سرور. لطفاً بعداً دوباره تلاش کنید."
        : "ورود انجام نشد. لطفاً دوباره تلاش کنید.";
  }
}

export default function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { username: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (data) => {
      setUser(toAuthUser(data));

      const returnTo = params.get(RETURN_TO_PARAM);
      const destination =
        returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : ROUTES.adminHome;

      router.replace(destination);
      router.refresh();
    },
    onError: () => {
      setFocus("password", { shouldSelect: true });
    },
  });

  const busy = isSubmitting || mutation.isPending || mutation.isSuccess;

  const serverError = mutation.error ? messageFor(mutation.error) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">ورود کارکنان</h1>
            <p className="text-sm text-fg-muted">پنل مدیریت</p>
          </header>

          <form
            noValidate
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <Input
              label="نام کاربری"
              autoComplete="username"
              autoFocus
              error={errors.username?.message}
              {...register("username")}
            />

            <Input
              label="رمز عبور"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            {serverError && (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
              >
                {serverError}
              </p>
            )}

            <Button type="submit" loading={busy} fullWidth>
              ورود
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
