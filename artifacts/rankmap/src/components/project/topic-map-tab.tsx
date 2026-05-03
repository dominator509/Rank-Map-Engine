import { useGetTopicMap, getGetTopicMapQueryKey } from "@workspace/api-client-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, ChevronRight } from "lucide-react";

interface Props { projectId: number }

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-200",
  approved: "bg-green-500/10 text-green-600 border-green-200",
  rejected: "bg-red-500/10 text-red-500 border-red-200",
};

export function TopicMapTab({ projectId }: Props) {
  const { data: topicMap, isLoading } = useGetTopicMap(projectId, {
    query: { enabled: !!projectId, queryKey: getGetTopicMapQueryKey(projectId) },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const coveragePct = topicMap
    ? Math.round((topicMap.approvedClusters / Math.max(topicMap.totalClusters, 1)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Topic Map</h2>
        <p className="text-sm text-muted-foreground">
          Topical authority coverage across your content pillars
        </p>
      </div>

      {!topicMap || topicMap.totalClusters === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Map className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-lg">No topic map yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create and approve clusters to build your topical authority map.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-5 border rounded-xl text-center">
              <div className="text-3xl font-bold text-primary">
                {Math.round(topicMap.authorityScore * 100)}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Authority Score</div>
            </div>
            <div className="p-5 border rounded-xl text-center">
              <div className="text-3xl font-bold">{topicMap.approvedClusters}</div>
              <div className="text-sm text-muted-foreground mt-1">Approved Clusters</div>
            </div>
            <div className="p-5 border rounded-xl text-center">
              <div className="text-3xl font-bold">{topicMap.totalClusters}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Clusters</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Coverage</span>
              <span className="font-medium">{coveragePct}%</span>
            </div>
            <Progress value={coveragePct} className="h-2" />
          </div>

          {topicMap.pillars.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No pillar clusters defined yet. Mark a cluster as type "pillar" in the Clusters tab.
            </p>
          ) : (
            <div className="space-y-6">
              {topicMap.pillars.map(pillar => (
                <div key={pillar.id} className="border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 bg-muted/40 border-b">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                    <div className="flex-1">
                      <span className="font-semibold">{pillar.label}</span>
                      <span className="text-sm text-muted-foreground ml-3">
                        {pillar.keywordCount} keyword{pillar.keywordCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">Pillar</Badge>
                  </div>
                  {pillar.clusters.length > 0 ? (
                    <div className="divide-y">
                      {pillar.clusters.map(cluster => (
                        <div key={cluster.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 ml-2" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{cluster.label}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{cluster.keywordCount} kw</span>
                            {cluster.avgScore != null && (
                              <span>score {Math.round(cluster.avgScore * 100)}</span>
                            )}
                            <Badge
                              variant="outline"
                              className={`capitalize ${STATUS_BADGE[cluster.status] ?? ""}`}
                            >
                              {cluster.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground px-5 py-4">
                      No supporting clusters assigned to this pillar.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
