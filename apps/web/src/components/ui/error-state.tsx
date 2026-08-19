"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "./button-styles";

export interface ErrorStateProps {
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
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
