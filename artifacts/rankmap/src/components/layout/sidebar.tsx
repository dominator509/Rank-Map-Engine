import { Link, useLocation } from "wouter";
import { 
  Key, 
  LayoutDashboard, 
  Map, 
  Settings,
  Users,
  Cpu,
  CreditCard,
  Shield,
  Webhook,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Clients", icon: Users, href: "/clients" },
  { title: "AI Tasks", icon: Cpu, href: "/ai-tasks" },
];

const WORKSPACE_NAV_ITEMS = [
  { title: "Team", icon: Users, href: "/team" },
  { title: "Integrations", icon: Plug, href: "/integrations" },
  { title: "Webhooks", icon: Webhook, href: "/webhooks" },
  { title: "API Keys", icon: Key, href: "/api-keys" },
  { title: "Audit Log", icon: Shield, href: "/audit-log" },
];

const BOTTOM_NAV_ITEMS = [
  { title: "Billing", icon: CreditCard, href: "/billing" },
  { title: "Settings", icon: Settings, href: "/settings" },
];

function NavLink({ item, isActive }: { item: { title: string; icon: React.ElementType; href: string }; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
      )}
      data-testid={`link-${item.title.toLowerCase().replace(/ /g, "-")}`}
    >
      <item.icon className="w-4 h-4" />
      {item.title}
    </Link>
  );
}

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-90" data-testid="link-logo">
          <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center shadow-sm">
            <Map className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">RankMap</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-4">
        <div>
          <div className="px-3 mb-1.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Platform
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} isActive={location.startsWith(item.href)} />
            ))}
          </nav>
        </div>

        <div>
          <div className="px-3 mb-1.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Workspace
          </div>
          <nav className="flex flex-col gap-0.5">
            {WORKSPACE_NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} isActive={location.startsWith(item.href)} />
            ))}
          </nav>
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <nav className="flex flex-col gap-0.5">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} isActive={location.startsWith(item.href)} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
