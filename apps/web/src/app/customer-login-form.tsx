"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, CardContent, Input, OtpInput } from "@/components/ui";
import { RETURN_TO_PARAM, ROUTES } from "@/config/routes";
import { ApiError } from "@/lib/api";
import { requestLoginOtp, verifyLoginOtp } from "@/lib/auth-api";
import { formatNumber } from "@/lib/format";
import { isValidMobile, normalizeMobile } from "@/lib/mobile";
import { announceOtpSent } from "@/lib/otp-toast";

/**
 * Customer sign-in -- the site's front door.
 *
 * There is no password and no registration form. Customers are created at the
 * counter by staff, and the API only issues a 'register' code to an admin
 * session, so a self-service sign-up here would be a button that always 403s.
 * The copy says so plainly rather than letting someone type a number, wait for
 * an SMS and work it out from a failure.
 *
 * Which is also why an unknown number stops the flow. `request-otp` answers 404
 * for a mobile with no customer; showing the code box anyway would leave someone
 * staring at five empty squares waiting for a message that is never coming.
 */

/** Mirrors OTP_LENGTH in apps/api/.env. */
const OTP_LENGTH = 5;

/**
 * Mapped on HTTP status, never on `error.message`: the API answers in English,
 * and its wording is a server concern that should not surface in a Persian UI.
 */
const OFFLINE = "اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";
const SERVER = "خطای سرور. لطفاً بعداً دوباره تلاش کنید.";

function statusOf(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null;
}

function messageForRequest(error: unknown): string {
  switch (statusOf(error)) {
    case null:
      return OFFLINE;
    case 400:
      return "شماره موبایل معتبر نیست.";
    case 429:
      return "درخواست‌های بیش از حد مجاز. کمی بعد دوباره تلاش کنید.";
    case 502:
      return "ارسال پیامک انجام نشد. لطفاً دوباره تلاش کنید.";
    default:
      return SERVER;
  }
}

function messageForVerify(error: unknown): string {
  switch (statusOf(error)) {
    case null:
      return OFFLINE;
    // 400 covers both a wrong code and an expired one; the two are not
    // distinguishable by status, so the message covers both and points at the
    // remedy for either.
    case 400:
      return "کد وارد شده نادرست یا منقضی شده است. دوباره تلاش کنید یا کد جدید بگیرید.";
    case 404:
      // Only reachable if the account was removed between the two calls.
      return "حساب شما دیگر در دسترس نیست. لطفاً به فروشگاه مراجعه کنید.";
    case 429:
      return "تلاش‌های نادرست بیش از حد مجاز. کد جدیدی درخواست کنید.";
    default:
      return SERVER;
  }
}

export default function CustomerLoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [mobile, setMobile] = React.useState("");
  const [code, setCode] = React.useState("");
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  /** The normalised number a code was actually sent to. Null before that. */
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  /** Ticks the resend countdown down to zero. */
  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const request = useMutation({
    mutationFn: (value: string) => requestLoginOtp(value),
    onSuccess: (result) => {
      // The API's normalised form, not what was typed: verify has to name the
      // same number the code was filed under.
      setSentTo(result.mobile);
      setCode("");
      setSecondsLeft(result.expiresInSeconds);
      verify.reset();
      // Shows the code itself when the API is mocking SMS; otherwise just
      // confirms a message went out.
      announceOtpSent(result.devOtpCode);
    },
  });

  const verify = useMutation({
    mutationFn: () => verifyLoginOtp({ mobile: sentTo!, code }),
    onSuccess: () => {
      const returnTo = params.get(RETURN_TO_PARAM);
      // Only ever follow a same-site path. An absolute URL here would make this
      // an open redirect: ?next=https://evil.example would land the customer
      // somewhere else immediately after authenticating.
      const destination =
        returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : ROUTES.customerHome;

      router.replace(destination);
      // The cookie the API just set is only visible to the middleware on the
      // next request; refresh so the guard re-runs with it.
      router.refresh();
    },
  });

  /**
   * An unknown number is not an error to retry -- it is the end of the road for
   * this flow, and it gets its own panel rather than a red line under the field.
   */
  const unregistered = statusOf(request.error) === 404;

  const submitMobile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidMobile(mobile)) return;
    request.mutate(normalizeMobile(mobile));
  };

  const startOver = () => {
    setSentTo(null);
    setCode("");
    setSecondsLeft(0);
    request.reset();
    verify.reset();
  };

  /** Busy through isSuccess: the redirect has not painted yet. */
  const verifying = verify.isPending || verify.isSuccess;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col items-center gap-1 text-center">
          <span className="text-lg font-bold text-fg">گالری طلای روزبه</span>
          <span className="text-xs text-fg-muted">حساب کاربری مشتریان</span>
        </header>

        <Card>
          <CardContent className="flex flex-col gap-6">
            {unregistered ? (
              <UnregisteredNotice mobile={mobile} onBack={startOver} />
            ) : sentTo ? (
              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  verify.mutate();
                }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-bold">کد تأیید</h1>
                  <p className="text-sm text-fg-muted">
                    کد {formatNumber(OTP_LENGTH)} رقمی ارسال‌شده به شماره‌ی زیر را
                    وارد کنید.
                  </p>
                  <p className="flex items-center gap-2 pt-1 text-sm">
                    <span className="font-mono text-fg" dir="ltr">
                      {sentTo}
                    </span>
                    <button
                      type="button"
                      onClick={startOver}
                      className="text-xs text-link hover:underline"
                    >
                      تغییر شماره
                    </button>
                  </p>
                </div>

                <OtpInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    // The complaint referred to the previous code.
                    if (verify.error) verify.reset();
                  }}
                  length={OTP_LENGTH}
                  autoFocus
                  invalid={Boolean(verify.error)}
                  disabled={verifying}
                />

                <div className="text-xs">
                  {secondsLeft > 0 ? (
                    <span className="text-fg-muted">
                      ارسال مجدد کد تا {formatNumber(secondsLeft)} ثانیه دیگر
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => request.mutate(sentTo)}
                      disabled={request.isPending}
                      className="text-link hover:underline disabled:opacity-50"
                    >
                      {request.isPending ? "در حال ارسال…" : "ارسال مجدد کد"}
                    </button>
                  )}
                </div>

                {verify.error && <FormError>{messageForVerify(verify.error)}</FormError>}
                {request.error && (
                  <FormError>{messageForRequest(request.error)}</FormError>
                )}

                <Button
                  type="submit"
                  loading={verifying}
                  disabled={code.length < OTP_LENGTH}
                  fullWidth
                >
                  ورود
                </Button>
              </form>
            ) : (
              <form noValidate onSubmit={submitMobile} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-bold">ورود</h1>
                  <p className="text-sm text-fg-muted">
                    با کد یک‌بار مصرف، بدون نیاز به رمز عبور.
                  </p>
                </div>

                <Input
                  label="شماره موبایل"
                  inputMode="numeric"
                  autoComplete="tel"
                  autoFocus
                  dir="ltr"
                  placeholder="09123456789"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  error={
                    // Only once something has been typed -- scolding an empty
                    // field before the first submit is noise.
                    mobile && !isValidMobile(mobile)
                      ? "شماره موبایل ۱۱ رقمی را کامل وارد کنید."
                      : undefined
                  }
                />

                {request.error && (
                  <FormError>{messageForRequest(request.error)}</FormError>
                )}

                <Button
                  type="submit"
                  loading={request.isPending}
                  disabled={!isValidMobile(mobile)}
                  fullWidth
                >
                  دریافت کد ورود
                </Button>

                <p className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-fg-muted">
                  ثبت‌نام از این صفحه امکان‌پذیر نیست. فقط مشتریانی که در فروشگاه
                  ثبت شده‌اند می‌توانند وارد شوند.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

/**
 * The dead end, said plainly.
 *
 * No "try again" on the same number -- it would fail identically. The only
 * routes out are a different number or a trip to the shop.
 */
function UnregisteredNotice({
  mobile,
  onBack,
}: {
  mobile: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full bg-warning/12 text-warning"
      >
        <UserIcon />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-bold text-fg">حساب شما پیدا نشد</h1>
        <p className="text-sm leading-relaxed text-fg-muted">
          شماره‌ی{" "}
          <span className="font-mono text-fg-secondary" dir="ltr">
            {normalizeMobile(mobile)}
          </span>{" "}
          در سیستم ثبت نشده است. برای ساخت حساب، لطفاً به فروشگاه مراجعه کنید؛
          ثبت‌نام فقط توسط همکاران ما انجام می‌شود.
        </p>
      </div>

      <Button type="button" variant="secondary" onClick={onBack} fullWidth>
        وارد کردن شماره‌ی دیگر
      </Button>
    </div>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      aria-live="polite"
      className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
    >
      {children}
    </p>
  );
}

function UserIcon() {
  return (
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
