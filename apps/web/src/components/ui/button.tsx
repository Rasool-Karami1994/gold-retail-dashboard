"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap " +
  "transition-[background-color,box-shadow,opacity] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 " +
  "disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  // The reference's signature button: solid indigo with a soft blue halo that
  // intensifies on hover.
  primary:
    "bg-primary-500 text-white shadow-glow-sm hover:bg-primary-600 hover:shadow-glow active:bg-primary-700",
  secondary:
    "bg-surface-raised text-fg border border-border hover:border-border-strong hover:bg-surface-overlay",
  ghost: "text-fg-secondary hover:bg-surface-raised hover:text-fg",
  danger: "bg-danger text-white hover:bg-danger/90",
  link: "text-link underline-offset-4 hover:underline p-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-12 px-6 text-base rounded-lg",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
  /** Sits at the inline-start edge (right, in RTL). */
  startIcon?: React.ReactNode;
  /** Sits at the inline-end edge (left, in RTL). */
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      startIcon,
      endIcon,
      fullWidth,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          base,
          variants[variant],
          variant !== "link" && sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : startIcon}
        {children}
        {endIcon}
      </button>
    );
  },
);

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
