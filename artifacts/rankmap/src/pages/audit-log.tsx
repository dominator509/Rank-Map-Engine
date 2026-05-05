import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface AuditEntry {
  id: number;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

const ACTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "team.member_removed": "destructive",
  "api_key.revoked": "destructive",
  "integration.removed": "destructive",
  "webhook.deleted": "destructive",
  "cluster.approved": "default",
  "brief.approved": "default",
};

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? "secondary";
  const label = action
    .split(".")
    .map((s) => s.replace(/_/g, " "))
    .join(" → ");
  return (
    <Badge variant={color} className="text-xs font-mono">
      {label}
    </Badge>
  );
}

export default function AuditLog() {
  const [offset, setOffset] = useState(0);
  const [resourceType, setResourceType] = useState("all");
  const limit = 50;

  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (resourceType !== "all") params.set("resourceType", resourceType);

  const { data, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["audit-log", offset, resourceType],
    queryFn: () => customFetch(`/api/audit-log?${params}`),
  });

  const entries = data ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            All significant actions performed in your workspace
          </p>
        </div>

        <div className="flex gap-3">
          <Select
            value={resourceType}
            onValueChange={(v) => {
              setResourceType(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All resource types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="cluster">Cluster</SelectItem>
              <SelectItem value="brief">Brief</SelectItem>
              <SelectItem value="report">Report</SelectItem>
              <SelectItem value="api_key">API Key</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="integration">Integration</SelectItem>
              <SelectItem value="invitation">Invitation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" /> Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>No audit events found</p>
              </div>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => (
                  <div key={entry.id} className="py-3 flex items-start gap-4">
                    <div className="w-36 shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ActionBadge action={entry.action} />
                        <span className="text-xs text-muted-foreground">
                          {entry.resourceType}
                          {entry.resourceId ? ` #${entry.resourceId}` : ""}
                        </span>
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {JSON.stringify(entry.metadata)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {entry.userName && <p className="text-xs font-medium">{entry.userName}</p>}
                      {entry.ipAddress && (
                        <p className="text-xs text-muted-foreground font-mono">{entry.ipAddress}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {entries.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Showing {offset + 1}–{offset + entries.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={entries.length < limit}
                    onClick={() => setOffset(offset + limit)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
