"use client";

import { RouteError } from "@/components/ui";

/**
 * Catches a render that threw anywhere inside the admin shell.
 *
 * Inside the `(shell)` group on purpose: the sidebar and top bar are the
 * layout's, so they survive and the failure is contained to the page area --
 * the admin can navigate somewhere else instead of being stranded on a blank
 * screen with no chrome.
 */
export default function AdminShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} />;
}
