"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";

/**
 * TanStack Query defaults.
 *
 * `staleTime: 60s` -- this dashboard reads slow-moving records (customers,
 * invoices, daily gold rates). Refetching on every remount would triple the
 * request count for data that rarely changes within a minute.
 *
 * `retry` skips 4xx. A 401, 403, 404 or 422 is a settled answer; retrying it
 * three times just delays the error the user needs to see, and on a 401 it
 * hammers an endpoint that will keep refusing until they sign in again.
 */
const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 60_000,
    // Keep unused data around for 5 minutes so back-navigation is instant.
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (typeof status === "number" && status >= 400 && status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    // Tab focus is a weak signal that data went stale; staleTime already
    // covers the cases that matter and this avoids surprise refetch storms.
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    // Never silently replay a write -- a retried POST can double-charge.
    retry: false,
  },
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState, not a module-level client: on the server a module singleton would
  // be shared across concurrent requests and leak one user's cache into
  // another's response.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions }));

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
