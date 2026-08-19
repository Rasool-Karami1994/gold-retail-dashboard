import { SidebarMenuButton } from "@/components/ui";
import { CustomerSidebar } from "./customer-sidebar";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <CustomerSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-sunken px-4 md:hidden">
          <SidebarMenuButton className="-ms-2" />
          <span className="text-sm font-bold text-fg">گالری طلای روزبه</span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
