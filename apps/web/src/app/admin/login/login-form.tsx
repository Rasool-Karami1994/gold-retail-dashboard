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

/**
 * Staff sign-in.
 *
 * Rendered outside the `admin/(shell)` route group, so it gets no sidebar --
 * the shell is for someone who is already signed in, and showing its
 * navigation to a stranger would advertise the app's structure and flash a
 * layout that is about to be replaced.
 */

/**
 * Client-side validation only catches empty and obviously-too-short input.
 * It deliberately does NOT mirror the server's password rules: the real check
 * is the bcrypt comparison in the API, and encoding the policy here would
 * leak it to anyone reading the bundle.
 */
const loginSchema = z.object({
  username: z.string().trim().min(1, "نام کاربری را وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Turns a failure into something a Persian-speaking user can read.
 *
 * Deliberately maps on STATUS rather than forwarding `error.message`. The API
 * answers in English ("Invalid username or password"), which would be the only
 * English string in the interface, and its wording is a server-side concern
 * that shouldn't leak into the UI. It also means a future backend change to an
 * error string can't silently alter what users are told.
 */
function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    // Never reached the server at all -- offline, DNS, CORS, API down.
    return "اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";
  }

  switch (error.status) {
    case 400:
      return "اطلاعات وارد شده معتبر نیست.";
    case 401:
      // The API intentionally does not say which half was wrong; neither do we.
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
    // Validate on submit, then live once a field has been corrected --
    // validating on every keystroke from the start scolds people mid-typing.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { username: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (data) => {
      // Populate the store so the shell can render a name immediately instead
      // of waiting a round trip for /me.
      setUser(toAuthUser(data));

      const returnTo = params.get(RETURN_TO_PARAM);
      // Only ever follow a same-site path. An absolute URL here would make the
      // login page an open redirect: ?next=https://evil.example lands the user
      // somewhere else immediately after authenticating.
      const destination =
        returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : ROUTES.adminHome;

      router.replace(destination);
      // The cookie the API just set is only visible to the middleware on the
      // next request; refresh so the guard re-runs with it.
      router.refresh();
    },
    onError: () => {
      // Put the cursor back on the password and select it, so a retry is just
      // "type the right one" -- a wrong password is far likelier than a wrong
      // username, and the username stays filled in.
      //
      // The fields are deliberately NOT disabled while the request is in
      // flight: a disabled input cannot receive focus, so this call would be a
      // no-op against an element React has not re-enabled yet. The submit
      // button carries the busy state instead.
      setFocus("password", { shouldSelect: true });
    },
  });

  /**
   * `isSubmitting` alone would flick back to idle the moment the mutation
   * resolves, before the redirect paints. Keeping the button busy through
   * `isPending` and `isSuccess` avoids a frame where it looks clickable again.
   */
  const busy = isSubmitting || mutation.isPending || mutation.isSuccess;

  const serverError = mutation.error ? messageFor(mutation.error) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">ورود به پنل مدیریت</h1>
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
              // aria-live so a screen reader announces the failure; the field
              // errors above are already tied to their inputs by the Input
              // component's aria-describedby.
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
