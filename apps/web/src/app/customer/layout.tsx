import { SidebarMenuButton } from "@/components/ui";
import { CustomerSidebar } from "./customer-sidebar";

/**
 * Chrome for the signed-in customer area.
 *
 * Mirrors the admin shell's structure -- h-dvh + overflow-hidden pins the rail
 * and gives the content column its own scroll context, so a long table scrolls
 * beside a fixed sidebar rather than pushing it off screen.
 *
 * There is no top bar: with two destinations, the name and the way out fit in
 * the rail's footer, and a second strip of chrome would cost height that the
 * table wants.
 */
export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <CustomerSidebar />

      {/* min-w-0 stops a wide table from forcing the whole page to scroll. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          Mobile-only strip. From `md` the rail is on screen and carries the
          branding itself, so this would be a second header saying the same
          thing -- but below it the rail is a drawer, and without this there
          would be no way to open it.
        */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-sunken px-4 md:hidden">
          <SidebarMenuButton className="-ms-2" />
          <span className="text-sm font-bold text-fg">گالری طلای روزبه</span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
