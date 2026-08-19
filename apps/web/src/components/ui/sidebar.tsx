"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui.store";

export interface SidebarItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  exact?: boolean;
  activeWhen?: (pathname: string) => boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const RAIL = "w-64 md:w-[4.5rem]";
const EXPANDED = `${RAIL} lg:w-64`;

export function sidebarWideOnly(
  collapsed: boolean,
  display: "block" | "flex" = "block",
): string {
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

  React.useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

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
          "fixed inset-y-0 start-0 z-50 transition-transform duration-200 ease-out",
          drawerOpen ? "translate-x-0" : "invisible translate-x-full",
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
            aria-label={collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
            className={cn(
              "shrink-0 rounded-md p-2 text-fg-muted transition-colors",
              "hover:bg-surface-raised hover:text-fg",
              "hidden lg:block",
            )}
          >
          <ChevronIcon
            className={cn(
              "size-4 transition-transform duration-200",
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
