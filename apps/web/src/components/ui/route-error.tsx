"use client";

import * as React from "react";
import { Card, CardContent } from "./card";
import { buttonStyles } from "./button-styles";

/**
 * The body of every `error.tsx` in this app.
 *
 * Next's error boundaries catch what a query's own `isError` branch cannot: a
 * render that threw, a bad shape from the API that broke a `.map`, a bug in a
 * cell renderer. Those leave the segment with no UI at all, and without a
 * boundary the whole app blanks to Next's default page.
 *
 * `reset()` re-renders the segment without a full reload, so a transient
 * failure costs one click rather than the page state.
 *
 * The message is deliberately generic. `error.message` is whatever threw --
 * often English, sometimes a stack fragment -- and this is a Persian UI shown
 * to shop staff and customers. The digest is printed small because it is the
 * only thing that ties a user's report to a server log line.
 */
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
    // The boundary swallows it otherwise, and a silent failure in production is
    // one nobody can diagnose.
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
