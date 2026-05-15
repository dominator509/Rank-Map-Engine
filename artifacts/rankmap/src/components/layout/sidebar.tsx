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
  Bell,
  Globe,
  BarChart2,
  Activity,
  LayoutTemplate,
  SlidersHorizontal,
  Clock,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

type NavItem = { title: string; icon: React.ElementType; href: string };

const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Clients", icon: Users, href: "/clients" },
  { title: "AI Tasks", icon: Cpu, href: "/ai-tasks" },
];

const INSIGHTS_NAV: NavItem[] = [
  { title: "Analytics", icon: BarChart2, href: "/analytics" },
  { title: "Rank Tracking", icon: BarChart2, href: "/rankings" },
  { title: "Competitors", icon: Globe, href: "/competitors" },
  { title: "Usage", icon: Activity, href: "/usage" },
];

const TOOLS_NAV: NavItem[] = [
  { title: "Report Schedules", icon: Clock, href: "/report-schedules" },
  { title: "Templates", icon: LayoutTemplate, href: "/templates" },
  { title: "Custom Fields", icon: SlidersHorizontal, href: "/custom-fields" },
];

const WORKSPACE_NAV_ITEMS: NavItem[] = [
  { title: "Team", icon: Users, href: "/team" },
  { title: "Integrations", icon: Plug, href: "/integrations" },
  { title: "Webhooks", icon: Webhook, href: "/webhooks" },
  { title: "API Keys", icon: Key, href: "/api-keys" },
  { title: "Audit Log", icon: Shield, href: "/audit-log" },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { title: "Privacy & Data", icon: Lock, href: "/privacy" },
  { title: "Billing", icon: CreditCard, href: "/billing" },
  { title: "Settings", icon: Settings, href: "/settings" },
];

function NavLink({ item, badge }: { item: NavItem; badge?: number }) {
  const [location] = useLocation();
  const isActive =
    location === item.href || (item.href.length > 1 && location.startsWith(item.href));
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70",
      )}
      data-testid={`link-${item.title.toLowerCase().replace(/ /g, "-")}`}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.title}</span>
      {badge !== undefined && badge > 0 && (
        <Badge className="h-4 px-1 text-[10px] min-w-[16px] flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </Badge>
      )}
    </Link>
  );
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <div className="px-3 mb-1.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
        {title}
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => customFetch("/api/notifications/unread-count"),
    refetchInterval: 30000,
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 transition-opacity hover:opacity-90"
          data-testid="link-logo"
        >
          <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center shadow-sm">
            <Map className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">RankMap</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-4">
        <NavSection title="Platform" items={NAV_ITEMS} />
        <NavSection title="Insights" items={INSIGHTS_NAV} />
        <NavSection title="Tools" items={TOOLS_NAV} />
        <NavSection title="Workspace" items={WORKSPACE_NAV_ITEMS} />

        <div>
          <div className="px-3 mb-1.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            You
          </div>
          <nav className="flex flex-col gap-0.5">
            <NavLink
              item={{ title: "Notifications", icon: Bell, href: "/notifications" }}
              badge={unread?.count}
            />
          </nav>
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <nav className="flex flex-col gap-0.5">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
