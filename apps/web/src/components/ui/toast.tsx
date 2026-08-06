"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import {
  useToastStore,
  type Toast as ToastEntry,
  type ToastVariant,
} from "@/stores/toast.store";

/**
 * Renders the toast queue. Mount once, at the root layout.
 *
 * Positioned with logical `start-*`, so the stack sits on the reading-start
 * edge -- the right in RTL, the left in LTR -- and follows the writing
 * direction without a per-locale override.
 */

const variantStyles: Record<ToastVariant, string> = {
  success: "border-success/40 bg-success-bg",
  error: "border-danger/40 bg-danger-bg",
  warning: "border-warning/40 bg-warning-bg",
  info: "border-primary-500/40 bg-surface-raised",
};

const iconColor: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

/**
 * The open `<dialog>`, if there is one, so the stack can be rendered inside it.
 *
 * WHY THIS EXISTS. `<Modal>` opens with showModal(), which promotes the dialog
 * to the browser's TOP LAYER -- painted above every normal stacking context,
 * z-index irrelevant. A toast raised while a modal was open (the mock OTP code
 * in the add-customer flow, for one) was drawn underneath it and its dimming
 * backdrop: invisible, and impossible to dismiss.
 *
 * Joining the top layer via the popover attribute does not fix it. A popover
 * shown *after* a modal dialog still paints below it, and re-promoting it makes
 * no difference -- verified in the browser before settling on this.
 *
 * So the stack goes INSIDE the dialog, which is the one place guaranteed to be
 * above it. Watching the DOM rather than asking Modal to co-operate keeps the
 * fix in this file and covers any future dialog, including ones this component
 * knows nothing about.
 */
function useTopLayerHost(): HTMLElement | null {
  const [host, setHost] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const sync = () => {
      // Last in document order: with nested dialogs the innermost is the one
      // on top, and that is where a toast has to go to be seen.
      const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      setHost(open.length ? (open[open.length - 1] as HTMLElement) : null);
    };

    sync();

    // `open` is a plain attribute, so a mutation observer sees showModal() and
    // close() without Modal having to announce either.
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });

    return () => observer.disconnect();
  }, []);

  return host;
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const host = useTopLayerHost();

  const stack = (
    <div
      // `role="region"` + polite live region: additions are announced without
      // interrupting whatever the screen reader is currently saying. Errors
      // opt into assertive individually, below.
      role="region"
      aria-label="اعلان‌ها"
      className={cn(
        "pointer-events-none fixed bottom-4 start-4 z-50",
        "flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3",
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );

  // `fixed` positions against the viewport either way, so the stack sits in the
  // same corner whether it is portaled or not. A dialog's UA `overflow: auto`
  // does not clip it: fixed descendants escape ancestor overflow.
  return host ? createPortal(stack, host) : stack;
}

function ToastItem({ toast }: { toast: ToastEntry }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [leaving, setLeaving] = React.useState(false);

  const close = React.useCallback(() => {
    // Let the exit transition play before the node is removed.
    setLeaving(true);
    window.setTimeout(() => dismiss(toast.id), 150);
  }, [dismiss, toast.id]);

  React.useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(close, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, close]);

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg",
        "transition-[opacity,transform] duration-150",
        leaving ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
        variantStyles[toast.variant],
      )}
    >
      <span className={cn("mt-0.5 shrink-0", iconColor[toast.variant])}>
        <ToastIcon variant={toast.variant} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-fg">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-fg-secondary">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              close();
            }}
            className="mt-1 self-start text-xs font-medium text-link hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="بستن اعلان"
        className="-me-1 -mt-1 shrink-0 rounded-md p-1 text-fg-muted transition-colors hover:bg-surface/60 hover:text-fg"
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const paths: Record<ToastVariant, React.ReactNode> = {
    success: <path d="m5 13 4 4L19 7" />,
    error: <path d="M18 6 6 18M6 6l12 12" />,
    warning: <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
    info: <path d="M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  };

  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[variant]}
    </svg>
  );
}

// Note: `toast` and the store are deliberately NOT re-exported from this file.
// Re-exporting non-component values from a module that also exports a component
// forces Fast Refresh into a full page reload on every edit. Import them from
// "@/stores/toast.store", or from the ui barrel, which does it for you.
