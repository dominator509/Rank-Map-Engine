import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart2, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { parsePositiveRouteInt } from "@/lib/route-params";

interface Client {
  id: number;
  name: string;
}
interface Project {
  id: number;
  name: string;
  clientId: number;
}
interface RankedKeyword {
  id: number;
  phrase: string;
  searchVolume?: number;
  latestPosition: number | null;
  latestUrl: string | null;
  checkedAt: string | null;
}

function PositionBadge({ pos }: { pos: number | null }) {
  if (pos === null)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not tracked
      </Badge>
    );
  if (pos <= 3) return <Badge className="bg-green-600 hover:bg-green-700">#{pos}</Badge>;
  if (pos <= 10) return <Badge className="bg-emerald-500 hover:bg-emerald-600">#{pos}</Badge>;
  if (pos <= 30)
    return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">#{pos}</Badge>;
  return <Badge variant="destructive">#{pos}</Badge>;
}

export default function Rankings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => customFetch("/api/clients"),
  });
  const projectId = parsePositiveRouteInt(selectedProjectId);

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const result: Project[] = [];
      for (const c of clients as Client[]) {
        const ps = await customFetch(`/api/clients/${c.id}/projects`);
        result.push(...(ps as Project[]));
      }
      return result;
    },
    enabled: (clients as Client[]).length > 0,
  });

  const { data: rankings = [], isLoading } = useQuery<RankedKeyword[]>({
    queryKey: ["/api/projects", projectId, "rankings"],
    queryFn: () => customFetch(`/api/projects/${projectId}/rankings`),
    enabled: !!projectId,
  });

  const checkAll = useMutation({
    mutationFn: () =>
      customFetch(`/api/projects/${projectId}/rankings/check-all`, { method: "POST" }),
    onSuccess: (data: { checked: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "rankings"] });
      toast({ title: `Checked ${data.checked} keywords` });
    },
    onError: () => toast({ title: "Check failed", variant: "destructive" }),
  });

  const ranked = (rankings as RankedKeyword[]).filter((r) => r.latestPosition !== null);
  const top10 = ranked.filter((r) => (r.latestPosition ?? 999) <= 10).length;
  const top30 = ranked.filter((r) => (r.latestPosition ?? 999) <= 30).length;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart2 className="w-7 h-7" />
              Rank Tracking
            </h1>
            <p className="text-muted-foreground mt-1">Monitor keyword positions over time</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Choose a project..." />
            </SelectTrigger>
            <SelectContent>
              {(allProjects as Project[]).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {projectId && (
            <Button onClick={() => checkAll.mutate()} disabled={checkAll.isPending}>
              {checkAll.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check All Rankings
            </Button>
          )}
        </div>

        {projectId && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Top 10</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{top10}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Top 30</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{top30}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Tracked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{ranked.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Keyword Positions</CardTitle>
                <CardDescription>Latest position data for all project keywords</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-40 bg-muted rounded animate-pulse" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Checked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rankings as RankedKeyword[]).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.phrase}</TableCell>
                          <TableCell>{r.searchVolume?.toLocaleString() ?? "—"}</TableCell>
                          <TableCell>
                            <PositionBadge pos={r.latestPosition} />
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                            {r.latestUrl ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.checkedAt ? format(new Date(r.checkedAt), "MMM d, HH:mm") : "Never"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
