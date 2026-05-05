import { useListAiTasks, getListAiTasksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Cpu, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-200">
          <Clock className="w-3 h-3 mr-1" /> Queued
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-200">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running
        </Badge>
      );
    case "awaiting_approval":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
          <Clock className="w-3 h-3 mr-1" /> Awaiting Approval
        </Badge>
      );
    case "approved":
    case "completed":
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-200">
          <AlertCircle className="w-3 h-3 mr-1" /> Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AiTasks() {
  const { data: tasks, isLoading } = useListAiTasks(undefined, {
    query: { queryKey: getListAiTasksQueryKey(), refetchInterval: 5000 },
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Tasks</h1>
          <p className="text-muted-foreground mt-1">Queue status for automated generation jobs</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cpu className="w-5 h-5 text-primary" />
              Task Queue
            </CardTitle>
            <CardDescription>Recent and active jobs across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !tasks?.length ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No AI tasks yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tasks appear here when you cluster keywords or generate briefs.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-sm capitalize">
                        {task.taskType.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {task.projectId ? `Project ${task.projectId}` : "Workspace-level"} &middot;
                        via {task.provider}
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
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
