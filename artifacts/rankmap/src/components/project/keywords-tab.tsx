import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListKeywords, getListKeywordsQueryKey,
  useCreateKeyword, useImportKeywords, useDeleteKeyword,
  useGetScoreSettings, getGetScoreSettingsQueryKey,
  useUpdateScoreSettings,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Trash2, ChevronDown, Tag, Settings2 } from "lucide-react";

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-500/10 text-blue-600 border-blue-200",
  navigational: "bg-purple-500/10 text-purple-600 border-purple-200",
  commercial: "bg-amber-500/10 text-amber-600 border-amber-200",
  transactional: "bg-green-500/10 text-green-600 border-green-200",
};

interface Props { projectId: number }

export function KeywordsTab({ projectId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [importSource, setImportSource] = useState<"manual" | "csv">("csv");
  const [importText, setImportText] = useState("");

  const { data: keywords, isLoading } = useListKeywords(projectId, undefined, {
    query: { enabled: !!projectId, queryKey: getListKeywordsQueryKey(projectId) },
  });

  const { data: scoreSettings } = useGetScoreSettings(projectId, {
    query: { enabled: !!projectId, queryKey: getGetScoreSettingsQueryKey(projectId) },
  });

  const createKeyword = useCreateKeyword();
  const importKeywords = useImportKeywords();
  const deleteKeyword = useDeleteKeyword();
  const updateScoreSettings = useUpdateScoreSettings();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey(projectId) });

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createKeyword.mutate(
      {
        projectId,
        data: {
          phrase: fd.get("phrase") as string,
          searchVolume: fd.get("searchVolume") ? Number(fd.get("searchVolume")) : undefined,
          kd: fd.get("kd") ? Number(fd.get("kd")) : undefined,
          cpc: fd.get("cpc") ? Number(fd.get("cpc")) : undefined,
          intent: (fd.get("intent") as "informational" | "navigational" | "commercial" | "transactional") || undefined,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setIsAddOpen(false);
          toast({ title: "Keyword added" });
          (e.target as HTMLFormElement).reset();
        },
        onError: () => toast({ title: "Failed to add keyword", variant: "destructive" }),
      },
    );
  };

  const handleImport = () => {
    const lines = importText.split("\n").map(l => l.trim()).filter(Boolean);
    const kwds = lines.map(phrase => ({ phrase }));
    importKeywords.mutate(
      { projectId, data: { source: importSource, keywords: kwds } },
      {
        onSuccess: (res) => {
          invalidate();
          setIsImportOpen(false);
          setImportText("");
          toast({ title: `Imported ${res.imported} keywords (${res.duplicates} duplicates skipped)` });
        },
        onError: () => toast({ title: "Import failed", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this keyword?")) return;
    deleteKeyword.mutate(
      { projectId, id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Keyword deleted" }); },
        onError: () => toast({ title: "Delete failed", variant: "destructive" }),
      },
    );
  };

  const handleSaveWeights = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateScoreSettings.mutate(
      {
        projectId,
        data: {
          volumeWeight: Number(fd.get("volumeWeight")),
          kdWeight: Number(fd.get("kdWeight")),
          intentWeight: Number(fd.get("intentWeight")),
          cpcWeight: Number(fd.get("cpcWeight")),
          freshnessWeight: Number(fd.get("freshnessWeight")),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          queryClient.invalidateQueries({ queryKey: getGetScoreSettingsQueryKey(projectId) });
          toast({ title: "Score weights updated — keywords re-scored" });
        },
        onError: () => toast({ title: "Failed to save weights", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Keywords</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {keywords?.length ?? 0} keyword{keywords?.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" /> Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Keywords</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={importSource} onValueChange={(v) => setImportSource(v as "manual" | "csv")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV / Paste</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Keywords (one per line)</Label>
                  <Textarea
                    placeholder={"best seo tools\nkeyword research software\n..."}
                    rows={10}
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {importText.split("\n").filter(l => l.trim()).length} keywords detected
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleImport}
                  disabled={importKeywords.isPending || !importText.trim()}
                >
                  {importKeywords.isPending ? "Importing..." : "Import"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" /> Add Keyword
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAdd}>
                <DialogHeader>
                  <DialogTitle>Add Keyword</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Phrase *</Label>
                    <Input name="phrase" required placeholder="best seo tools" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Volume</Label>
                      <Input name="searchVolume" type="number" min="0" placeholder="1000" />
                    </div>
                    <div className="space-y-2">
                      <Label>KD (0–100)</Label>
                      <Input name="kd" type="number" min="0" max="100" placeholder="45" />
                    </div>
                    <div className="space-y-2">
                      <Label>CPC ($)</Label>
                      <Input name="cpc" type="number" min="0" step="0.01" placeholder="2.50" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Intent</Label>
                    <Select name="intent">
                      <SelectTrigger><SelectValue placeholder="Select intent" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="informational">Informational</SelectItem>
                        <SelectItem value="navigational">Navigational</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="transactional">Transactional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createKeyword.isPending}>
                    {createKeyword.isPending ? "Adding..." : "Add Keyword"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Settings2 className="w-4 h-4 mr-2" />
            Score Weights
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isSettingsOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {scoreSettings && (
            <form onSubmit={handleSaveWeights} className="mt-3 p-4 border rounded-lg bg-muted/30 space-y-4">
              <p className="text-xs text-muted-foreground">
                Weights must sum to 1.0. Changing weights re-scores all keywords.
              </p>
              <div className="grid grid-cols-5 gap-3">
                {(["volumeWeight", "kdWeight", "intentWeight", "cpcWeight", "freshnessWeight"] as const).map(key => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs capitalize">{key.replace("Weight", "")}</Label>
                    <Input
                      name={key}
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      defaultValue={scoreSettings[key]}
                    />
                  </div>
                ))}
              </div>
              <Button type="submit" size="sm" disabled={updateScoreSettings.isPending}>
                Save Weights
              </Button>
            </form>
          )}
        </CollapsibleContent>
      </Collapsible>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !keywords?.length ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-lg">No keywords yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add keywords manually or import from a CSV export.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phrase</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Volume</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">KD</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">CPC</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Intent</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-32">Score</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {keywords.map(kw => (
                <tr key={kw.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{kw.phrase}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {kw.searchVolume != null ? kw.searchVolume.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {kw.kd != null ? kw.kd : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {kw.intent ? (
                      <Badge variant="outline" className={`text-xs ${INTENT_COLORS[kw.intent] ?? ""}`}>
                        {kw.intent}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(kw.finalScore ?? 0) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-xs font-medium w-8 text-right">
                        {kw.finalScore != null ? Math.round(kw.finalScore * 100) : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(kw.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
