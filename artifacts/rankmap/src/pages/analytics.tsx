import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2, TrendingUp, FileText, Cpu, Users, Folder, Tag, Layout } from "lucide-react";

interface Overview {
  totals: {
    clients: number;
    projects: number;
    keywords: number;
    clusters: number;
    briefs: number;
    reports: number;
    aiTasksThisMonth: number;
  };
  keywordsBySource: { source: string; c: number }[];
  briefsByStatus: { status: string; c: number }[];
  clustersByStatus: { status: string; c: number }[];
}

interface ProjectStat {
  id: number;
  name: string;
  keywordCount: number;
  clusterCount: number;
  briefCount: number;
}

interface VelocityRow {
  day: string;
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  draft: "bg-gray-400",
  "in-progress": "bg-blue-500",
  published: "bg-emerald-600",
};

export default function Analytics() {
  const { data: overview, isLoading: overviewLoading } = useQuery<Overview>({
    queryKey: ["/api/analytics/overview"],
    queryFn: () => customFetch("/api/analytics/overview"),
  });

  const { data: projects = [], isLoading: projLoading } = useQuery<ProjectStat[]>({
    queryKey: ["/api/analytics/projects"],
    queryFn: () => customFetch("/api/analytics/projects"),
  });

  const { data: velocity = [] } = useQuery<VelocityRow[]>({
    queryKey: ["/api/analytics/velocity"],
    queryFn: () => customFetch("/api/analytics/velocity"),
  });

  const maxCount = Math.max(...(velocity as VelocityRow[]).map((v) => v.count), 1);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="w-7 h-7" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Workspace-wide performance overview</p>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {overviewLoading
            ? Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))
            : [
                { label: "Clients", value: overview?.totals.clients, icon: Users },
                { label: "Projects", value: overview?.totals.projects, icon: Folder },
                { label: "Keywords", value: overview?.totals.keywords, icon: Tag },
                { label: "Clusters", value: overview?.totals.clusters, icon: Layout },
                { label: "Briefs", value: overview?.totals.briefs, icon: FileText },
                { label: "Reports", value: overview?.totals.reports, icon: BarChart2 },
                { label: "AI Tasks (30d)", value: overview?.totals.aiTasksThisMonth, icon: Cpu },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {label}
                    </CardTitle>
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{value ?? 0}</div>
                  </CardContent>
                </Card>
              ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Keyword velocity */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Keyword Velocity (30 days)
              </CardTitle>
              <CardDescription>New keywords added per day</CardDescription>
            </CardHeader>
            <CardContent>
              {(velocity as VelocityRow[]).length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  No keywords added in the last 30 days.
                </p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {(velocity as VelocityRow[]).map((v) => (
                    <div key={v.day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-primary/70 rounded-t-sm transition-all"
                        style={{ height: `${(v.count / maxCount) * 100}%`, minHeight: "2px" }}
                        title={`${v.day}: ${v.count}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brief status breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Brief Pipeline</CardTitle>
              <CardDescription>Status distribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overviewLoading ? (
                <Skeleton className="h-24" />
              ) : (
                (overview?.briefsByStatus ?? []).map((b) => (
                  <div key={b.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`}
                      />
                      <span className="text-sm capitalize">{b.status}</span>
                    </div>
                    <Badge variant="secondary">{b.c}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Per-project breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Per-Project Breakdown</CardTitle>
            <CardDescription>Keywords, clusters, and briefs per project</CardDescription>
          </CardHeader>
          <CardContent>
            {projLoading ? (
              <Skeleton className="h-40" />
            ) : (projects as ProjectStat[]).length === 0 ? (
              <p className="text-muted-foreground text-sm">No projects yet.</p>
            ) : (
              <div className="space-y-3">
                {(projects as ProjectStat[]).map((p) => (
                  <div key={p.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1 font-medium">{p.name}</div>
                    <Badge variant="outline">{p.keywordCount} keywords</Badge>
                    <Badge variant="outline">{p.clusterCount} clusters</Badge>
                    <Badge variant="outline">{p.briefCount} briefs</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
