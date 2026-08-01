"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { RETURN_TO_PARAM, ROUTES } from "@/config/routes";
import { ApiError, apiFetch } from "@/lib/api";

/**
 * Staff sign-in. Minimal on purpose -- it exists so the middleware's redirect
 * target resolves and the guard can be exercised end to end.
 */
export default function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await apiFetch("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      // The middleware reads the cookie the API just set; refresh so it runs.
      router.replace(params.get(RETURN_TO_PARAM) ?? ROUTES.adminHome);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "اتصال به سرور برقرار نشد.",
      );
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">ورود کارکنان</h1>
            <p className="text-sm text-fg-muted">پنل مدیریت</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input
              label="نام کاربری"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <Input
              label="رمز عبور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}

            <Button type="submit" loading={pending} fullWidth>
              ورود
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
