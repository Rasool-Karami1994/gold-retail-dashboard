import { AdminSidebar } from "./admin-sidebar";

/**
 * Chrome for the signed-in admin area.
 *
 * This is a route group -- `(shell)` doesn't appear in the URL, so the pages
 * inside it stay at /admin/overview and /admin/design. It exists so that
 * /admin/login, which sits outside the group, renders without the sidebar
 * wrapped around it.
 */
export default function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      {/* min-w-0 stops a wide table from forcing the whole page to scroll. */}
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
