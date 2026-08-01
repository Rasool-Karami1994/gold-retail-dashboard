"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { RETURN_TO_PARAM, ROUTES } from "@/config/routes";
import { ApiError, apiFetch } from "@/lib/api";

/**
 * Customer sign-in. Customers have no password -- they receive a 5-digit code
 * by SMS and enter it here.
 *
 * Registration is deliberately absent: `purpose: "register"` codes are issued
 * from the staff "add customer" screen and the API rejects them without an
 * admin session, so there is nothing for the public page to call.
 */
export default function CustomerLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await apiFetch("/api/customer/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ mobile, purpose: "login" }),
      });
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "اتصال به سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await apiFetch("/api/customer/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ mobile, code, purpose: "login" }),
      });
      router.replace(params.get(RETURN_TO_PARAM) ?? ROUTES.customerHome);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "اتصال به سرور برقرار نشد.");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">ورود</h1>
            <p className="text-sm text-fg-muted">
              {step === "mobile"
                ? "با کد یک‌بار مصرف، بدون نیاز به رمز عبور"
                : `کد ارسال‌شده به ${mobile} را وارد کنید`}
            </p>
          </div>

          {step === "mobile" ? (
            <form onSubmit={requestCode} className="flex flex-col gap-4">
              <Input
                label="شماره موبایل"
                inputMode="numeric"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
                required
              />
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" loading={pending} fullWidth>
                دریافت کد
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="flex flex-col gap-4">
              <Input
                label="کد تأیید"
                inputMode="numeric"
                maxLength={5}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                required
              />
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" loading={pending} fullWidth>
                تأیید و ورود
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("mobile");
                  setCode("");
                  setError(null);
                }}
              >
                تغییر شماره
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
