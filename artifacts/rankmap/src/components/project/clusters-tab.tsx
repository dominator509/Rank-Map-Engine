import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClusters, getListClustersQueryKey,
  useCreateCluster, useClusterKeywords,
  useApproveCluster, useRejectCluster, useDeleteCluster,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Zap, CheckCircle, XCircle, Trash2, Layers, RefreshCw } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-200",
  approved: "bg-green-500/10 text-green-600 border-green-200",
  rejected: "bg-red-500/10 text-red-500 border-red-200",
};

interface Props { projectId: number }

export function ClustersTab({ projectId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: clusters, isLoading } = useListClusters(projectId, undefined, {
    query: { enabled: !!projectId, queryKey: getListClustersQueryKey(projectId) },
  });

  const createCluster = useCreateCluster();
  const clusterKeywords = useClusterKeywords();
  const approveCluster = useApproveCluster();
  const rejectCluster = useRejectCluster();
  const deleteCluster = useDeleteCluster();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListClustersQueryKey(projectId) });

  const handleAutoCluster = () => {
    clusterKeywords.mutate(
      { projectId },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "AI clustering queued", description: "Clusters will appear shortly." });
        },
        onError: () => toast({ title: "Auto-cluster failed", variant: "destructive" }),
      },
    );
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createCluster.mutate(
      {
        projectId,
        data: {
          label: fd.get("label") as string,
          pillarTopic: (fd.get("pillarTopic") as string) || undefined,
          clusterType: (fd.get("clusterType") as "pillar" | "cluster" | "supporting") || "cluster",
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          toast({ title: "Cluster created" });
          (e.target as HTMLFormElement).reset();
        },
        onError: () => toast({ title: "Failed to create cluster", variant: "destructive" }),
      },
    );
  };

  const handleApprove = (id: number) => {
    approveCluster.mutate(
      { projectId, id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Cluster approved" }); },
      },
    );
  };

  const handleReject = (id: number) => {
    rejectCluster.mutate(
      { projectId, id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Cluster rejected" }); },
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this cluster?")) return;
    deleteCluster.mutate(
      { projectId, id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Cluster deleted" }); },
      },
    );
  };

  const filtered = filterStatus === "all"
    ? clusters
    : clusters?.filter(c => c.status === filterStatus);

  const pendingCount = clusters?.filter(c => c.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clusters</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clusters?.length ?? 0} cluster{clusters?.length !== 1 ? "s" : ""}
            {pendingCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">{pendingCount} awaiting review</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoCluster}
            disabled={clusterKeywords.isPending}
          >
            {clusterKeywords.isPending
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Clustering...</>
              : <><Zap className="w-4 h-4 mr-2" /> Auto-Cluster</>
            }
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" /> New Cluster
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create Cluster</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Cluster Label *</Label>
                    <Input name="label" required placeholder="SEO Tools Comparison" />
                  </div>
                  <div className="space-y-2">
                    <Label>Pillar Topic</Label>
                    <Input name="pillarTopic" placeholder="SEO Software" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cluster Type</Label>
                    <Select name="clusterType" defaultValue="cluster">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pillar">Pillar</SelectItem>
                        <SelectItem value="cluster">Cluster</SelectItem>
                        <SelectItem value="supporting">Supporting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createCluster.isPending}>
                    Create Cluster
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2">
        {["all", "pending", "approved", "rejected"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${
              filterStatus === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !filtered?.length ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-lg">No clusters</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Use Auto-Cluster to group your keywords, or create clusters manually.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cluster => (
            <div
              key={cluster.id}
              className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">{cluster.label}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${STATUS_BADGE[cluster.status] ?? ""}`}
                  >
                    {cluster.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize text-muted-foreground">
                    {cluster.clusterType}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {cluster.pillarTopic && <span>Pillar: {cluster.pillarTopic}</span>}
                  <span>{cluster.keywordCount} keyword{cluster.keywordCount !== 1 ? "s" : ""}</span>
                  {cluster.avgScore != null && (
                    <span>Avg score: {Math.round(cluster.avgScore * 100)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {cluster.status === "pending" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleApprove(cluster.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleReject(cluster.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
                {cluster.status === "rejected" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-600 hover:bg-amber-50"
                    onClick={() => handleApprove(cluster.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Re-approve
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(cluster.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
