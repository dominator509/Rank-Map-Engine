import { ReactNode } from "react";
import { Link } from "wouter";
import { BarChart2, CreditCard, FlaskConical, LayoutDashboard, Settings, Users } from "lucide-react";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

const MOBILE_NAV_ITEMS = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Clients", icon: Users, href: "/clients" },
  { title: "Analytics", icon: BarChart2, href: "/analytics" },
  { title: "GEO/AEO", icon: FlaskConical, href: "/geo-aeo" },
  { title: "Billing", icon: CreditCard, href: "/billing" },
  { title: "Settings", icon: Settings, href: "/settings" },
];

function MobileNav() {
  return (
    <header className="md:hidden sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-bold tracking-tight">
          RankMap
        </Link>
      </div>
      <nav aria-label="Mobile primary navigation" className="flex gap-1 overflow-x-auto px-2 pb-2">
        {MOBILE_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid={`mobile-link-${item.title.toLowerCase().replace(/ /g, "-")}`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex w-full">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col h-[100dvh] overflow-hidden">
        <MobileNav />
        <div id="main-content" className="min-w-0 flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
