import { useGetContentRoadmap, getGetContentRoadmapQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, CalendarRange } from "lucide-react";

interface Props {
  projectId: number;
}

const CLUSTER_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-200",
  approved: "bg-green-500/10 text-green-600 border-green-200",
  rejected: "bg-red-500/10 text-red-500 border-red-200",
};

const BRIEF_STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600 border-slate-200",
  approved: "bg-green-500/10 text-green-600 border-green-200",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-200",
  published: "bg-purple-500/10 text-purple-600 border-purple-200",
};

export function RoadmapTab({ projectId }: Props) {
  const { data: roadmap, isLoading } = useGetContentRoadmap(projectId, {
    query: { enabled: !!projectId, queryKey: getGetContentRoadmapQueryKey(projectId) },
  });

  const handleExportCsv = () => {
    window.open(`/api/projects/${projectId}/roadmap?format=csv`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Content Roadmap</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clusters ranked by priority score — highest opportunity first
          </p>
        </div>
        {roadmap && roadmap.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        )}
      </div>

      {!roadmap?.length ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <CalendarRange className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-lg">No roadmap data yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add keywords and create clusters to generate a prioritized content roadmap.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-10">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cluster</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pillar</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Keywords</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-36">Avg Score</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Brief</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roadmap.map((item, idx) => (
                <tr key={item.clusterId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3 font-medium">{item.clusterLabel}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.pillarTopic ?? <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {item.keywordCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={(item.avgScore ?? 0) * 100} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium w-8 text-right">
                        {item.avgScore != null ? Math.round(item.avgScore * 100) : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${CLUSTER_STATUS_BADGE[item.clusterStatus] ?? ""}`}
                    >
                      {item.clusterStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.briefStatus ? (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${BRIEF_STATUS_BADGE[item.briefStatus] ?? ""}`}
                      >
                        {item.briefStatus.replace("_", " ")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">No brief</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
