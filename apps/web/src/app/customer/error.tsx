"use client";

import { RouteError } from "@/components/ui";

/** Same containment as the admin shell: the rail survives, the page recovers. */
export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} />;
}
