"use client";

import { useEffect } from "react";
import { useUiStore } from "@/stores/ui.store";

export function StoreHydration() {
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);

  return null;
}
