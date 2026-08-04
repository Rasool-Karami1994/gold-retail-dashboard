"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "./button-styles";

/**
 * "This didn't load — try again", in the space the content would have taken.
 *
 * A failed list or chart is not a toast: a toast is for something that happened
 * beside what you are looking at, and this IS what you are looking at. It also
 * has to carry the retry, because the alternative is asking the user to reload
 * the whole page to re-run one query.
 *
 * Toasts stay for failed WRITES, where the screen behind them is still valid
 * and the message is about an action rather than a region.
 */
export interface ErrorStateProps {
  /** What failed, in Persian. Keep it about the content, not the HTTP status. */
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** `bare` drops the border and background, for use inside a card that has its own. */
  variant?: "panel" | "bare";
  className?: string;
}

export function ErrorState({
  message = "بارگذاری اطلاعات انجام نشد.",
  onRetry,
  retryLabel = "تلاش دوباره",
  variant = "panel",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-12 text-center",
        variant === "panel" && "rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <span aria-hidden="true" className="text-danger">
        <AlertIcon />
      </span>

      <p className="text-sm text-fg-secondary">{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

function AlertIcon() {
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
      <path d="M12 9v4m0 4h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
