import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Folder, Tag, Cpu, FileText, Clock } from "lucide-react";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });

  const metrics = [
    { label: "Total Clients", value: dashboard?.clientCount ?? 0, icon: Users },
    { label: "Active Projects", value: dashboard?.projectCount ?? 0, icon: Folder },
    { label: "Tracked Keywords", value: dashboard?.keywordCount ?? 0, icon: Tag },
    { label: "Clusters", value: dashboard?.clusterCount ?? 0, icon: Cpu },
    { label: "Content Briefs", value: dashboard?.briefCount ?? 0, icon: FileText },
    { label: "Pending Approvals", value: dashboard?.pendingApprovals ?? 0, icon: Clock },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your workspace</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>AI Tasks This Month</CardTitle>
            <CardDescription>
              Automated generation jobs consumed this billing period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <div className="text-4xl font-bold">{dashboard?.aiTasksThisMonth ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
