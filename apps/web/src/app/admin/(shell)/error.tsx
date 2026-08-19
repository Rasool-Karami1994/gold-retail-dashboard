"use client";

import { RouteError } from "@/components/ui";

export default function AdminShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} />;
}
