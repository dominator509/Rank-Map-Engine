import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2, Globe, TrendingUp, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery as useGetClients } from "@tanstack/react-query";

interface Project {
  id: number;
  name: string;
  clientId: number;
}
interface Client {
  id: number;
  name: string;
}
interface Competitor {
  id: number;
  domain: string;
  label?: string;
}
interface GapKeyword {
  id: number;
  phrase: string;
  searchVolume?: number;
  finalScore?: number;
  competitorCoverage: { domain: string; ranking: number | null }[];
}

export default function Competitors() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newDomain, setNewDomain] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showGap, setShowGap] = useState(false);

  const { data: clients = [] } = useGetClients<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => customFetch("/api/clients"),
  });

  const projectId = selectedProjectId ? parseInt(selectedProjectId, 10) : null;

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

  const { data: competitors = [], isLoading } = useQuery<Competitor[]>({
    queryKey: ["/api/projects", projectId, "competitors"],
    queryFn: () => customFetch(`/api/projects/${projectId}/competitors`),
    enabled: !!projectId,
  });

  const { data: gapData, isFetching: gapLoading } = useQuery<{
    keywords: GapKeyword[];
    competitors: Competitor[];
  }>({
    queryKey: ["/api/projects", projectId, "competitors/keyword-gap"],
    queryFn: () => customFetch(`/api/projects/${projectId}/competitors/keyword-gap`),
    enabled: !!projectId && showGap,
  });

  const addCompetitor = useMutation({
    mutationFn: () =>
      customFetch(`/api/projects/${projectId}/competitors`, {
        method: "POST",
        body: JSON.stringify({ domain: newDomain, label: newLabel }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "competitors"] });
      setNewDomain("");
      setNewLabel("");
      toast({ title: "Competitor added" });
    },
    onError: () => toast({ title: "Failed to add competitor", variant: "destructive" }),
  });

  const removeCompetitor = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/projects/${projectId}/competitors/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "competitors"] }),
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="w-7 h-7" />
            Competitor Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Track competitor domains and discover keyword gaps
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Project</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {projectId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Competitor Domains</CardTitle>
                <CardDescription>
                  Domains you're competing against for keyword rankings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="competitor.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="max-w-xs"
                  />
                  <Input
                    placeholder="Label (optional)"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button
                    onClick={() => addCompetitor.mutate()}
                    disabled={!newDomain || addCompetitor.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>

                {isLoading ? (
                  <div className="h-20 bg-muted rounded animate-pulse" />
                ) : (competitors as Competitor[]).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No competitors tracked yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(competitors as Competitor[]).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{c.domain}</span>
                          {c.label && <Badge variant="secondary">{c.label}</Badge>}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeCompetitor.mutate(c.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Keyword Gap Analysis
                  </CardTitle>
                  <CardDescription>
                    Keywords your competitors rank for but you may not
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowGap(true)}
                  disabled={gapLoading || (competitors as Competitor[]).length === 0}
                >
                  {gapLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4 mr-2" />
                  )}
                  Analyse Gap
                </Button>
              </CardHeader>
              <CardContent>
                {gapData ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Score</TableHead>
                        {(gapData.competitors as Competitor[]).map((c) => (
                          <TableHead key={c.id}>{c.domain}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(gapData.keywords as GapKeyword[]).slice(0, 50).map((kw) => (
                        <TableRow key={kw.id}>
                          <TableCell className="font-medium">{kw.phrase}</TableCell>
                          <TableCell>{kw.searchVolume?.toLocaleString() ?? "—"}</TableCell>
                          <TableCell>{kw.finalScore?.toFixed(1) ?? "—"}</TableCell>
                          {kw.competitorCoverage.map((cc, i) => (
                            <TableCell key={i}>
                              {cc.ranking ? (
                                <Badge variant="destructive">#{cc.ranking}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600">
                                  Not ranking
                                </Badge>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Click "Analyse Gap" to see keyword overlap with your competitors.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
