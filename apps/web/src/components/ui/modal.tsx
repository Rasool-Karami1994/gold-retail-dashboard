"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: Size;
  /** Set false to require an explicit action to dismiss. */
  dismissible?: boolean;
  className?: string;
}

/**
 * Built on the native <dialog> element, which gives us focus trapping, inert
 * background content and Esc-to-close without a third-party dependency.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
  className,
}: ModalProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Esc triggers `cancel`; let the parent own the open state.
  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (dismissible) onClose();
  };

  // The dialog element fills the viewport, so a click landing on it rather
  // than on the panel is a backdrop click.
  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (dismissible && event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      onCancel={handleCancel}
      onClick={handleClick}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "m-auto w-[calc(100%-2rem)] bg-transparent p-0 text-fg backdrop:bg-black/60",
        "backdrop:backdrop-blur-sm open:flex",
        sizes[size],
      )}
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-xl border border-border",
          "bg-surface-overlay shadow-lg",
          className,
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div className="flex flex-col gap-1">
              {title && (
                <h2 id={titleId} className="text-lg font-bold">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>

            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن"
                className={cn(
                  "-me-2 shrink-0 rounded-md p-2 text-fg-muted",
                  "transition-colors hover:bg-surface-raised hover:text-fg",
                )}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {children && <div className="px-6 py-5 text-sm">{children}</div>}

        {footer && (
          <div className="flex items-center justify-start gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
