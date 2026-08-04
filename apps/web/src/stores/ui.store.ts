import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Chrome-level UI state: sidebar collapse and the modal stack.
 *
 * Only `sidebarCollapsed` is persisted -- it is a durable preference. Modal
 * state is deliberately not, because restoring a half-finished dialog after a
 * reload is confusing rather than helpful.
 */

export interface ModalEntry {
  id: string;
  /** Arbitrary data the modal needs, e.g. the row being edited. */
  payload?: unknown;
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /**
   * The mobile drawer. Separate from `sidebarCollapsed` and NOT persisted:
   * collapse is a durable preference about a rail that is always on screen,
   * this is a transient "is the overlay open right now". Restoring an open
   * drawer on the next page load would be a menu nobody asked for.
   */
  sidebarDrawerOpen: boolean;
  openSidebarDrawer: () => void;
  closeSidebarDrawer: () => void;

  /**
   * A stack, not a single value, so a confirmation dialog can open on top of a
   * form without destroying it. The last entry is the one on top.
   */
  modals: ModalEntry[];
  openModal: (id: string, payload?: unknown) => void;
  /** Closes `id`, or the topmost modal when called with no argument. */
  closeModal: (id?: string) => void;
  closeAllModals: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      sidebarDrawerOpen: false,
      openSidebarDrawer: () => set({ sidebarDrawerOpen: true }),
      closeSidebarDrawer: () => set({ sidebarDrawerOpen: false }),

      modals: [],
      openModal: (id, payload) =>
        set((state) =>
          // Re-opening an already-open modal replaces its payload rather than
          // stacking a duplicate on top of itself.
          state.modals.some((modal) => modal.id === id)
            ? {
                modals: state.modals.map((modal) =>
                  modal.id === id ? { id, payload } : modal,
                ),
              }
            : { modals: [...state.modals, { id, payload }] },
        ),
      closeModal: (id) =>
        set((state) => ({
          modals: id
            ? state.modals.filter((modal) => modal.id !== id)
            : state.modals.slice(0, -1),
        })),
      closeAllModals: () => set({ modals: [] }),
    }),
    {
      name: "g-dash:ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
      /**
       * The server has no localStorage, so it always renders the default. If we
       * hydrated synchronously on the client, a user whose stored preference is
       * "collapsed" would produce markup that disagrees with the server's and
       * React would log a hydration mismatch.
       *
       * Instead we skip automatic hydration and replay it after mount, from
       * <StoreHydration /> in providers/store-hydration.tsx.
       */
      skipHydration: true,
    },
  ),
);

/* ---- Selectors ----------------------------------------------------------- */

export const useSidebarCollapsed = () => useUiStore((s) => s.sidebarCollapsed);
export const useSidebarDrawerOpen = () => useUiStore((s) => s.sidebarDrawerOpen);

/** True when `id` is anywhere in the stack. */
export const useIsModalOpen = (id: string) =>
  useUiStore((s) => s.modals.some((modal) => modal.id === id));

/** The payload passed to `openModal(id, payload)`, typed by the caller. */
export function useModalPayload<T>(id: string): T | undefined {
  return useUiStore(
    (s) => s.modals.find((modal) => modal.id === id)?.payload as T | undefined,
  );
}
