import { cn } from "@/lib/cn";

/**
 * The button's classes, without the button.
 *
 * Deliberately NOT in button.tsx: that file is `"use client"`, and everything a
 * client module exports becomes a client reference -- calling `buttonStyles()`
 * from a server component would fail with "attempted to call it from the server
 * but it is on the client". A plain string builder has no reason to be client
 * code, so it lives here and button.tsx imports it.
 *
 * Its other job is links that look like buttons. A `<button>` nested inside an
 * `<a>` is invalid HTML and loses middle-click and "open in new tab", so
 * navigation uses `<Link className={buttonStyles(...)}>` rather than wrapping a
 * Button. The `disabled:` utilities in `base` simply never match on an anchor.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap " +
  "transition-[background-color,box-shadow,opacity] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 " +
  "disabled:pointer-events-none disabled:opacity-45";

export const buttonVariants: Record<ButtonVariant, string> = {
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

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-12 px-6 text-base rounded-lg",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    buttonBase,
    buttonVariants[variant],
    variant !== "link" && buttonSizes[size],
    fullWidth && "w-full",
    className,
  );
}
