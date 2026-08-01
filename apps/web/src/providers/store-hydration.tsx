"use client";

import { useEffect } from "react";
import { useUiStore } from "@/stores/ui.store";

/**
 * Replays persisted UI state after mount.
 *
 * The UI store sets `skipHydration` so the first client render matches the
 * server's (which has no localStorage). Rehydrating here, in an effect, moves
 * the state change after hydration is complete and avoids the mismatch warning
 * -- at the cost of one frame where the sidebar shows its default width.
 */
export function StoreHydration() {
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);

  return null;
}
