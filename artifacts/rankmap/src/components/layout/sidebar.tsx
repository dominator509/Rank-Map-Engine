import { Link, useLocation } from "wouter";
import { 
  BarChart, 
  Folder, 
  Key, 
  LayoutDashboard, 
  Map, 
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Projects", icon: Folder, href: "/projects" },
  { title: "Keywords", icon: Key, href: "/keywords" },
  { title: "Reports", icon: BarChart, href: "/reports" },
];

const BOTTOM_NAV_ITEMS = [
  { title: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90" data-testid="link-logo">
          <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center shadow-sm">
            <Map className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">RankMap</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-6">
        <div className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
          Platform
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors opacity-50 cursor-not-allowed",
                location === item.href
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
              )}
              data-testid={`link-disabled-${item.title.toLowerCase()}`}
            >
              <item.icon className="w-4 h-4" />
              {item.title}
              <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold bg-sidebar-accent/50 text-sidebar-foreground/50 px-1.5 py-0.5 rounded">
                Soon
              </span>
            </div>
          ))}
        </nav>
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <nav className="flex flex-col gap-1">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <div
              key={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors opacity-50 cursor-not-allowed hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
              data-testid={`link-disabled-${item.title.toLowerCase()}`}
            >
              <item.icon className="w-4 h-4" />
              {item.title}
              <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold bg-sidebar-accent/50 text-sidebar-foreground/50 px-1.5 py-0.5 rounded">
                Soon
              </span>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
