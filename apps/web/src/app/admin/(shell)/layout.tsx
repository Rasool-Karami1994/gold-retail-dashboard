import { AdminSidebar } from "./admin-sidebar";
import { AdminTopBar } from "./admin-topbar";
import { SmsMockBanner } from "./sms-mock-banner";

/**
 * Chrome for the signed-in admin area.
 *
 * This is a route group -- `(shell)` doesn't appear in the URL, so the pages
 * inside it stay at /admin/overview, /admin/customers and so on. It exists so
 * that /admin/login, which sits outside the group, renders without the sidebar
 * wrapped around it.
 *
 * The sidebar and top bar live here rather than in each page, so they persist
 * across navigation: Next re-renders only the changing segment, which means the
 * rail keeps its collapse state and scroll position instead of remounting.
 */
export default function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // h-dvh + overflow-hidden pins the chrome and gives the content column its
    // own scroll context, so a long table scrolls under a fixed top bar rather
    // than pushing it off screen.
    <div className="flex h-dvh overflow-hidden">
      <AdminSidebar />

      {/* min-w-0 stops a wide table from forcing the whole page to scroll. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Above the top bar, not inside a page: it describes the whole
            deployment, and it renders nothing when SMS is real. */}
        <SmsMockBanner />
        <AdminTopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
