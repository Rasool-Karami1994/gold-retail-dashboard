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
 * Three widths, all in CSS rather than a `matchMedia` hook -- the server cannot
 * know the viewport, so a JS breakpoint would render one layout, hydrate, and
 * visibly snap to another on every load:
 *
 *   < md    an off-canvas DRAWER behind a hamburger. A 4.5rem rail is a fifth
 *           of a 375px phone, and the labels have to come back anyway.
 *   md..lg  icons only, whatever the stored preference says.
 *   lg+     the preference decides.
 *
 * Labels are always in the DOM and hidden with classes, which is also why they
 * stay available to a screen reader on the icon rail.
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

/** Full width as a drawer on mobile; a narrow rail from `md`. */
const RAIL = "w-64 md:w-[4.5rem]";
/** Same, but the preference gets the width back at `lg`. */
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
  // Visible in the mobile drawer either way -- it is full width there, and a
  // menu of unlabelled icons is not a menu.
  if (collapsed) return display === "flex" ? "flex md:hidden" : "block md:hidden";
  return display === "flex"
    ? "flex md:hidden lg:flex"
    : "block md:hidden lg:block";
}

export function Sidebar({ items, header, footer, className }: SidebarProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const drawerOpen = useUiStore((s) => s.sidebarDrawerOpen);
  const closeDrawer = useUiStore((s) => s.closeSidebarDrawer);
  const pathname = usePathname();

  const wideOnly = sidebarWideOnly(collapsed);

  // Navigating is the point of the drawer, so following a link closes it.
  // Keyed on pathname rather than an onClick per link, which would miss the
  // back button and any navigation triggered from inside a page.
  React.useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  // Escape closes it, matching every other overlay in the app.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      {/*
        Backdrop, mobile only. `inert`-like behaviour is not needed because the
        drawer is a sibling overlay rather than a modal dialog, but the click
        target has to cover the page or the only way out is the close button.
      */}
      {drawerOpen && (
        <div
          onClick={closeDrawer}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          "flex h-dvh flex-col border-s border-border bg-surface-sunken",
          // Mobile: off-canvas drawer pinned to the inline-START edge, which is
          // the RIGHT one under `dir="rtl"` -- the same side the rail occupies
          // in the flow. (`end-0` would be the left edge here, which is how this
          // first went wrong.) `translate-x-full` then parks it off that side.
          "fixed inset-y-0 start-0 z-50 transition-transform duration-200 ease-out",
          // `invisible` matters as much as the transform: a translated element
          // is still focusable and still read by a screen reader, so without it
          // Tab would walk an off-screen menu.
          drawerOpen ? "translate-x-0" : "invisible translate-x-full",
          // md+: back in the flow, always on screen, width does the animating.
          "md:visible md:static md:z-auto md:shrink-0 md:translate-x-0 md:transition-[width]",
          collapsed ? RAIL : EXPANDED,
          className,
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-2 border-b border-border px-4",
            collapsed
              ? "md:justify-center md:px-0"
              : "md:justify-center md:px-0 lg:justify-start lg:px-4",
          )}
        >
          <div className={cn("min-w-0 flex-1", wideOnly)}>{header}</div>

          {/* Closes the drawer. Mobile only -- from `md` the rail is part of
              the layout and there is nothing to dismiss. */}
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="بستن منو"
            className={cn(
              "shrink-0 rounded-md p-2 text-fg-muted transition-colors md:hidden",
              "hover:bg-surface-raised hover:text-fg",
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            // Distinct from the drawer's "باز کردن منو" / "بستن منو": this one
            // widens and narrows a rail that is already on screen. Two controls
            // sharing a name is ambiguous to anyone navigating by label.
            aria-label={collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
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
                  // Native tooltip carries the label on the icon rail. Not on
                  // mobile, where the label is right there next to the icon.
                  title={item.label}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2.5",
                    "text-sm transition-colors duration-150",
                    collapsed
                      ? "md:justify-center md:px-0"
                      : "md:justify-center md:px-0 lg:justify-start lg:px-3",
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
              collapsed ? "md:px-2" : "md:px-2 lg:px-3",
            )}
          >
            {footer}
          </div>
        )}
      </aside>
    </>
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
