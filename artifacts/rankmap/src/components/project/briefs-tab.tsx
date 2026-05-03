import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBriefs, getListBriefsQueryKey,
  useCreateBrief, useGenerateBrief, useApproveBrief, useDeleteBrief,
  useListClusters, getListClustersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Sparkles, CheckCircle, Trash2, FileText } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600 border-slate-200",
  approved: "bg-green-500/10 text-green-600 border-green-200",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-200",
  published: "bg-purple-500/10 text-purple-600 border-purple-200",
};

interface Props { projectId: number }

export function BriefsTab({ projectId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clusterId, setClusterId] = useState<string>("");

  const { data: briefs, isLoading } = useListBriefs(projectId, undefined, {
    query: { enabled: !!projectId, queryKey: getListBriefsQueryKey(projectId) },
  });

  const { data: clusters } = useListClusters(projectId, undefined, {
    query: { enabled: !!projectId, queryKey: getListClustersQueryKey(projectId) },
  });

  const createBrief = useCreateBrief();
  const generateBrief = useGenerateBrief();
  const approveBrief = useApproveBrief();
  const deleteBrief = useDeleteBrief();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListBriefsQueryKey(projectId) });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createBrief.mutate(
      {
        projectId,
        data: {
          title: fd.get("title") as string,
          clusterId: clusterId ? Number(clusterId) : undefined,
          targetWordCount: fd.get("wordCount") ? Number(fd.get("wordCount")) : undefined,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          setClusterId("");
          toast({ title: "Brief created" });
          (e.target as HTMLFormElement).reset();
        },
        onError: () => toast({ title: "Failed to create brief", variant: "destructive" }),
      },
    );
  };

  const handleGenerate = (id: number) => {
    generateBrief.mutate(
      { projectId, id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "AI brief generation queued" });
        },
        onError: () => toast({ title: "Generation failed", variant: "destructive" }),
      },
    );
  };

  const handleApprove = (id: number) => {
    approveBrief.mutate(
      { projectId, id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Brief approved" }); },
        onError: () => toast({ title: "Approve failed", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this brief?")) return;
    deleteBrief.mutate(
      { projectId, id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Brief deleted" }); },
      },
    );
  };

  const approvedClusters = clusters?.filter(c => c.status === "approved") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Content Briefs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {briefs?.length ?? 0} brief{briefs?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" /> New Brief
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Content Brief</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input name="title" required placeholder="The Ultimate Guide to SEO Tools" />
                </div>
                {approvedClusters.length > 0 && (
                  <div className="space-y-2">
                    <Label>Link to Cluster (optional)</Label>
                    <Select value={clusterId} onValueChange={setClusterId}>
                      <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                      <SelectContent>
                        {approvedClusters.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Target Word Count</Label>
                  <Input name="wordCount" type="number" min="100" placeholder="2000" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createBrief.isPending}>
                  Create Brief
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !briefs?.length ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-lg">No briefs yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create a manual brief or generate one with AI from an approved cluster.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {briefs.map(brief => (
            <div key={brief.id} className="flex items-start gap-4 p-4 border rounded-lg hover:border-primary/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">{brief.title}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${STATUS_STYLES[brief.status] ?? ""}`}
                  >
                    {brief.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {brief.targetWordCount && (
                    <span>{brief.targetWordCount.toLocaleString()} words target</span>
                  )}
                  {brief.outline && (
                    <span className="text-green-600">Outline generated</span>
                  )}
                  <span>{new Date(brief.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {brief.status === "draft" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleGenerate(brief.id)}
                      disabled={generateBrief.isPending}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Generate AI Outline
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-green-600 hover:bg-green-50"
                      onClick={() => handleApprove(brief.id)}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Approve
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(brief.id)}
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
