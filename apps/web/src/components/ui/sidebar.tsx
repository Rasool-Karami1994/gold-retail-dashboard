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
 *
 * BELOW `lg` THE RAIL IS ALWAYS ICONS-ONLY, whatever the stored preference says
 * -- a 16rem rail on a 768px tablet eats a fifth of the width that the tables
 * need. That is done in CSS rather than with a `matchMedia` hook on purpose:
 * the server cannot know the viewport, so a JS breakpoint would render expanded,
 * hydrate, and then visibly snap shut on every tablet load. Labels are always in
 * the DOM and hidden with classes, which is also why they stay available to a
 * screen reader.
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
  /**
   * Full control over the active test, for the case prefix matching gets
   * wrong: a parent link like `/admin/transactions` and a sibling below it
   * like `/admin/transactions/new` would otherwise both light up on the
   * child's route. `exact` fixes that but then breaks detail pages such as
   * `/admin/transactions/:id`, which should still mark the parent.
   *
   * Takes precedence over `exact` when both are given.
   */
  activeWhen?: (pathname: string) => boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
  /** Branding block, hidden when collapsed. */
  header?: React.ReactNode;
  /** Pinned to the bottom, e.g. the current user. */
  footer?: React.ReactNode;
  className?: string;
}

const RAIL = "w-[4.5rem]";
/** Narrow until `lg`, then honour the preference. */
const EXPANDED = `${RAIL} lg:w-64`;

/**
 * Classes for header/footer content that only belongs on a wide rail.
 *
 * Exported because those slots are filled by the caller -- admin-sidebar and
 * customer-sidebar each render a user block that has to disappear on the same
 * terms as the nav labels, or it overflows a 4.5rem rail on a tablet.
 *
 * Both branches are written out in full: Tailwind extracts class names by
 * scanning source text, so a template literal like `lg:${display}` produces no
 * CSS at all.
 */
export function sidebarWideOnly(
  collapsed: boolean,
  display: "block" | "flex" = "block",
): string {
  if (collapsed) return "hidden";
  return display === "flex" ? "hidden lg:flex" : "hidden lg:block";
}

export function Sidebar({ items, header, footer, className }: SidebarProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const pathname = usePathname();

  const wideOnly = sidebarWideOnly(collapsed);

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "flex h-dvh shrink-0 flex-col border-s border-border bg-surface-sunken",
        "transition-[width] duration-200 ease-out",
        collapsed ? RAIL : EXPANDED,
        className,
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 border-b border-border",
          collapsed ? "justify-center px-0" : "justify-center px-0 lg:justify-start lg:px-4",
        )}
      >
        <div className={cn("min-w-0 flex-1", wideOnly)}>{header}</div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "باز کردن منو" : "بستن منو"}
          className={cn(
            "shrink-0 rounded-md p-2 text-fg-muted transition-colors",
            "hover:bg-surface-raised hover:text-fg",
            // Below lg the width is fixed, so the control would do nothing
            // visible -- and a dead button is worse than no button.
            "hidden lg:block",
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
            const active = item.activeWhen
              ? item.activeWhen(pathname)
              : item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  // Native tooltip carries the label when there's no room for it.
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md py-2.5",
                    "text-sm transition-colors duration-150",
                    collapsed
                      ? "justify-center px-0"
                      : "justify-center px-0 lg:justify-start lg:px-3",
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

                  {/* Always rendered, hidden by class: a screen reader still
                      announces the destination when the rail is narrow, where
                      the icon alone would be the only accessible name. */}
                  <span className={cn("min-w-0 flex-1 truncate", wideOnly)}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full bg-danger px-1.5 py-0.5 text-2xs font-medium text-white",
                        wideOnly,
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {footer && (
        <div
          className={cn(
            "border-t border-border p-3",
            collapsed ? "px-2" : "px-2 lg:px-3",
          )}
        >
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
