"use client";

import * as React from "react";
import { Card, CardContent } from "./card";
import { buttonStyles } from "./button-styles";

export function RouteError({
  error,
  reset,
  title = "مشکلی پیش آمد",
  description = "این بخش بارگذاری نشد. لطفاً دوباره تلاش کنید.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  React.useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span aria-hidden="true" className="text-danger">
            <AlertIcon />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-bold text-fg">{title}</h1>
            <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
          </div>

          <button type="button" onClick={reset} className={buttonStyles()}>
            تلاش دوباره
          </button>

          {error.digest && (
            <p className="font-mono text-2xs text-fg-disabled" dir="ltr">
              {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertIcon() {
  return (
    <svg
      className="size-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 9v4m0 4h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
