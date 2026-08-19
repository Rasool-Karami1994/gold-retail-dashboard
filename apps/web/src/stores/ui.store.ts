import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface ModalEntry {
  id: string;
  payload?: unknown;
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  sidebarDrawerOpen: boolean;
  openSidebarDrawer: () => void;
  closeSidebarDrawer: () => void;

  modals: ModalEntry[];
  openModal: (id: string, payload?: unknown) => void;
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
      skipHydration: true,
    },
  ),
);

export const useSidebarCollapsed = () => useUiStore((s) => s.sidebarCollapsed);
export const useSidebarDrawerOpen = () => useUiStore((s) => s.sidebarDrawerOpen);

export const useIsModalOpen = (id: string) =>
  useUiStore((s) => s.modals.some((modal) => modal.id === id));

export function useModalPayload<T>(id: string): T | undefined {
  return useUiStore(
    (s) => s.modals.find((modal) => modal.id === id)?.payload as T | undefined,
  );
}
