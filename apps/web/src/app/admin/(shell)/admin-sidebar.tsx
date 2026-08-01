"use client";

import { Sidebar, type SidebarItem } from "@/components/ui";
import { useUiStore } from "@/stores/ui.store";

/**
 * Admin navigation. Icons are passed as nodes rather than pulled from an icon
 * package, so the kit stays dependency-free -- swap these for lucide-react or
 * anything else without touching Sidebar.
 */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const items: SidebarItem[] = [
  {
    href: "/admin/overview",
    label: "نمای کلی",
    icon: <Icon><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M9 22V12h6v10" /></Icon>,
  },
  {
    href: "/admin/transactions",
    label: "فاکتورها",
    icon: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Icon>,
    badge: "۳",
  },
  {
    href: "/admin/customers",
    label: "مشتریان",
    icon: <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></Icon>,
  },
  {
    href: "/admin/design",
    label: "کتابخانه",
    icon: <Icon><path d="M12 19l7-7 3 3-7 7-3-3Z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></Icon>,
  },
];

export function AdminSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <Sidebar
      items={items}
      header={
        <div className="flex flex-col">
          <span className="text-sm font-bold text-fg">جی‌داش</span>
          <span className="text-2xs text-fg-muted">پنل مدیریت</span>
        </div>
      }
      footer={
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised text-sm font-medium text-fg-secondary">
            ر
          </span>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm text-fg">رسول کرمی</span>
              <span className="text-2xs text-fg-muted">مدیر</span>
            </div>
          )}
        </div>
      }
    />
  );
}
