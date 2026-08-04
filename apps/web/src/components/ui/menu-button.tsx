"use client";

import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/cn";

/**
 * Opens the sidebar drawer. Mobile only.
 *
 * Lives beside the Sidebar rather than inside it because the trigger has to sit
 * in whatever header each area has -- the admin's top bar, the customer's
 * mobile-only strip -- while the drawer itself is the rail. Both talk to the
 * same store rather than passing a callback down two trees.
 */
export function SidebarMenuButton({ className }: { className?: string }) {
  const open = useUiStore((s) => s.openSidebarDrawer);
  const drawerOpen = useUiStore((s) => s.sidebarDrawerOpen);

  return (
    <button
      type="button"
      onClick={open}
      aria-label="باز کردن منو"
      aria-expanded={drawerOpen}
      className={cn(
        "shrink-0 rounded-md p-2 text-fg-secondary transition-colors md:hidden",
        "hover:bg-surface-raised hover:text-fg",
        className,
      )}
    >
      <svg
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
