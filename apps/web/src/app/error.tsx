"use client";

import { RouteError } from "@/components/ui";

/**
 * Catches everything outside the two shells -- sign-in, the admin login, the
 * redirect stubs. Those have no chrome to preserve, so this is the whole screen.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} />;
}
