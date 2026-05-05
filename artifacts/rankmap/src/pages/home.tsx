import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import {
  CheckCircle2,
  Circle,
  Activity,
  ShieldCheck,
  ListTodo,
  Route as RouteIcon,
} from "lucide-react";

const ROADMAP_PHASES = [
  { id: 0, name: "Repository Init & App Shell", status: "complete" },
  { id: 1, name: "Auth & RBAC", status: "upcoming" },
  { id: 2, name: "Client & Project Mgmt", status: "upcoming" },
  { id: 3, name: "Keyword Import", status: "upcoming" },
  { id: 4, name: "Keyword Scoring", status: "upcoming" },
  { id: 5, name: "AI Clustering", status: "upcoming" },
  { id: 6, name: "Topic Maps", status: "upcoming" },
  { id: 7, name: "Content Briefs", status: "upcoming" },
  { id: 8, name: "Reporting", status: "upcoming" },
  { id: 9, name: "Client Dashboard", status: "upcoming" },
  { id: 10, name: "Stripe Billing", status: "upcoming" },
];

const SHIPPED_ITEMS = [
  "TypeScript monorepo architecture",
  "React + Vite + Tailwind CSS frontend",
  "Drizzle ORM + PostgreSQL schema",
  "Zod input validation",
  "Vitest unit tests (2 passing)",
  "ESLint + Prettier configuration",
  "API Health Check endpoint",
  "Architecture documentation",
];

export default function Home() {
  const {
    data: healthData,
    isLoading: isHealthLoading,
    isError: isHealthError,
  } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey() },
  });

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="space-y-4">
            <h1
              className="text-4xl font-bold tracking-tight text-foreground"
              data-testid="text-app-name"
            >
              RankMap Initialization
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl" data-testid="text-tagline">
              Precision SEO instrumentation. Phase 0 systems are online, authenticated, and ready
              for product development.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Health Check Card */}
            <Card className="md:col-span-1 shadow-sm border-border/50" data-testid="card-health">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5 text-primary" />
                  System Health
                </CardTitle>
                <CardDescription>Live API connection status</CardDescription>
              </CardHeader>
              <CardContent>
                {isHealthLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" data-testid="skeleton-health" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : isHealthError ? (
                  <div
                    className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3 border border-destructive/20"
                    data-testid="status-health-error"
                  >
                    <Circle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div className="text-sm font-medium">API Connection Failed</div>
                  </div>
                ) : (
                  <div
                    className="p-4 bg-primary/10 text-primary-foreground rounded-lg flex items-start gap-3 border border-primary/20"
                    data-testid="status-health-ok"
                  >
                    <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">API Online</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Status:{" "}
                        <span className="font-mono bg-background/50 px-1 rounded">
                          {healthData?.status || "ok"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Checklist Card */}
            <Card className="md:col-span-2 shadow-sm border-border/50" data-testid="card-checklist">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListTodo className="w-5 h-5 text-primary" />
                  Phase 0 Checklist
                </CardTitle>
                <CardDescription>Foundation shipped in current build</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SHIPPED_ITEMS.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5"
                      data-testid={`item-shipped-${i}`}
                    >
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <span className="text-sm text-foreground/80">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Roadmap Card */}
            <Card className="md:col-span-3 shadow-sm border-border/50" data-testid="card-roadmap">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RouteIcon className="w-5 h-5 text-primary" />
                  Build Roadmap
                </CardTitle>
                <CardDescription>Upcoming development phases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ROADMAP_PHASES.map((phase) => (
                    <div
                      key={phase.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/20 transition-colors"
                      data-testid={`item-phase-${phase.id}`}
                    >
                      <div className="shrink-0 w-8 flex justify-center">
                        {phase.status === "complete" ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 ring-4 ring-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground w-16">
                            PHASE {phase.id}
                          </span>
                          <span className="text-sm font-medium truncate text-foreground">
                            {phase.name}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {phase.status === "complete" ? (
                          <Badge
                            variant="default"
                            className="bg-primary/10 text-primary hover:bg-primary/20 border-0"
                          >
                            Shipped
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Upcoming
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
