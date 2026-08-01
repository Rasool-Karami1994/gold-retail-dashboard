"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui.store";

/**
 * Collapsible navigation rail.
 *
 * Collapse state lives in the UI store (persisted), so it survives navigation
 * and reloads. In RTL the rail sits on the right; `border-s` and `start-*`
 * resolve to the correct physical side without a direction check.
 */

export interface SidebarItem {
  href: string;
  label: string;
  /** Any 20-24px icon node. Kept library-agnostic on purpose. */
  icon: React.ReactNode;
  /** Small count pill, e.g. unread notifications. */
  badge?: React.ReactNode;
  /**
   * By default a route is active when the pathname starts with `href`. Set
   * this for links like "/" that would otherwise match everything.
   */
  exact?: boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
  /** Branding block, hidden when collapsed. */
  header?: React.ReactNode;
  /** Pinned to the bottom, e.g. the current user. */
  footer?: React.ReactNode;
  className?: string;
}

const EXPANDED = "w-64";
const COLLAPSED = "w-[4.5rem]";

export function Sidebar({ items, header, footer, className }: SidebarProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const pathname = usePathname();

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "flex h-dvh shrink-0 flex-col border-s border-border bg-surface-sunken",
        "transition-[width] duration-200 ease-out",
        collapsed ? COLLAPSED : EXPANDED,
        className,
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 border-b border-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed && <div className="min-w-0 flex-1">{header}</div>}

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "باز کردن منو" : "بستن منو"}
          className={cn(
            "shrink-0 rounded-md p-2 text-fg-muted transition-colors",
            "hover:bg-surface-raised hover:text-fg",
          )}
        >
          <ChevronIcon
            className={cn(
              "size-4 transition-transform duration-200",
              // The chevron points the way the panel edge is about to move:
              // inline-start to collapse, inline-end to expand.
              //
              // SVG paths are not mirrored by `dir="rtl"`, so the flip has to
              // be explicit. The base path points physical-right, which is
              // inline-end in LTR and inline-start in RTL -- hence the opposite
              // variant in each case.
              collapsed ? "rtl:-scale-x-100" : "ltr:-scale-x-100",
            )}
          />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  // Native tooltip carries the label when there's no room for it.
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2.5",
                    "text-sm transition-colors duration-150",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-primary-500/12 font-medium text-fg"
                      : "text-fg-secondary hover:bg-surface-raised hover:text-fg",
                  )}
                >
                  {/* Active marker on the inline-start edge. */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary-500"
                    />
                  )}

                  <span
                    className={cn(
                      "shrink-0 transition-colors",
                      active ? "text-primary-400" : "text-fg-muted group-hover:text-fg-secondary",
                    )}
                  >
                    {item.icon}
                  </span>

                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="shrink-0 rounded-full bg-danger px-1.5 py-0.5 text-2xs font-medium text-white">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {footer && (
        <div className={cn("border-t border-border p-3", collapsed && "px-2")}>
          {footer}
        </div>
      )}
    </aside>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Points inline-end; RTL mirrors it via the parent's direction. */}
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
