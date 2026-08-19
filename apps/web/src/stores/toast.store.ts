import { create } from "zustand";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
  action?: { label: string; onClick: () => void };
}

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: Toast["action"];
  id?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "duration"> & { id?: string; duration?: number }) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

const MAX_VISIBLE = 4;

let counter = 0;
const nextId = () => `toast-${++counter}`;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: ({ id, duration, ...rest }) => {
    const toastId = id ?? nextId();
    const entry: Toast = {
      id: toastId,
      duration: duration ?? DEFAULT_DURATION[rest.variant],
      ...rest,
    };

    set((state) => {
      const existing = state.toasts.findIndex((t) => t.id === toastId);
      const next =
        existing >= 0
          ? state.toasts.map((t) => (t.id === toastId ? entry : t))
          : [...state.toasts, entry];

      return { toasts: next.slice(-MAX_VISIBLE) };
    });

    return toastId;
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  dismissAll: () => set({ toasts: [] }),
}));

function make(variant: ToastVariant) {
  return (title: string, options: ToastOptions = {}) =>
    useToastStore.getState().push({ variant, title, ...options });
}

export const toast = {
  success: make("success"),
  error: make("error"),
  warning: make("warning"),
  info: make("info"),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  dismissAll: () => useToastStore.getState().dismissAll(),
};
