import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Plus, Trash2, Play, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface WebhookEndpoint {
  id: number;
  url: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  createdAt: string;
}

interface WebhookDelivery {
  id: number;
  event: string;
  status: string;
  statusCode: number | null;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
}

const ALL_EVENTS = [
  "keyword.imported","cluster.created","cluster.approved","cluster.rejected",
  "brief.created","brief.approved","report.generated","project.created","ai_task.completed",
];

export default function Webhooks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: endpoints, isLoading } = useQuery<WebhookEndpoint[]>({
    queryKey: ["webhooks"],
    queryFn: () => customFetch("/api/webhooks"),
  });

  const { data: deliveries } = useQuery<WebhookDelivery[]>({
    queryKey: ["webhook-deliveries", expandedId],
    queryFn: () => customFetch(`/api/webhooks/${expandedId}/deliveries`),
    enabled: !!expandedId,
  });

  const createWebhook = useMutation({
    mutationFn: () => customFetch("/api/webhooks", { method: "POST", body: JSON.stringify({ url, events: selectedEvents, description }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsCreateOpen(false);
      setUrl(""); setDescription(""); setSelectedEvents([]);
      toast({ title: "Webhook created" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      customFetch(`/api/webhooks/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const deleteWebhook = useMutation({
    mutationFn: (id: number) => customFetch(`/api/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhooks"] }); toast({ title: "Webhook deleted" }); },
  });

  const testWebhook = useMutation({
    mutationFn: (id: number) => customFetch(`/api/webhooks/${id}/test`, { method: "POST" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhook-deliveries", expandedId] }); toast({ title: "Test event sent" }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Webhooks</h1>
            <p className="text-muted-foreground mt-1">Receive real-time event notifications</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Webhook</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Webhook</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Endpoint URL</Label>
                  <Input placeholder="https://your-app.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Input placeholder="e.g. Slack notifications" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Events ({selectedEvents.length === 0 ? "all" : selectedEvents.length + " selected"})</Label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {ALL_EVENTS.map((event) => (
                      <label key={event} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-muted rounded">
                        <Checkbox checked={selectedEvents.includes(event)} onCheckedChange={() => toggleEvent(event)} className="h-3.5 w-3.5" />
                        <span className="font-mono">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createWebhook.mutate()} disabled={!url || createWebhook.isPending} className="w-full">
                    {createWebhook.isPending ? "Creating..." : "Create Webhook"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : !endpoints || endpoints.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <Webhook className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No webhooks configured</p>
              <p className="text-sm mt-1">Add a webhook to receive real-time event notifications</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {endpoints.map((ep) => (
              <Card key={ep.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium truncate">{ep.url}</p>
                      {ep.description && <p className="text-xs text-muted-foreground mt-0.5">{ep.description}</p>}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {ep.events.length === 0 ? (
                          <Badge variant="secondary" className="text-xs">All events</Badge>
                        ) : ep.events.map((e) => (
                          <Badge key={e} variant="outline" className="text-xs font-mono">{e}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={ep.isActive} onCheckedChange={(v) => toggleActive.mutate({ id: ep.id, isActive: v })} />
                      <Button variant="outline" size="sm" onClick={() => testWebhook.mutate(ep.id)} className="h-8 px-2">
                        <Play className="w-3.5 h-3.5 mr-1" /> Test
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { if (confirm("Delete webhook?")) deleteWebhook.mutate(ep.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpandedId(expandedId === ep.id ? null : ep.id)}>
                        {expandedId === ep.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expandedId === ep.id && (
                  <CardContent className="pt-0">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Recent Deliveries</p>
                    {!deliveries || deliveries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No deliveries yet</p>
                    ) : (
                      <div className="divide-y">
                        {deliveries.map((d) => (
                          <div key={d.id} className="py-2 flex items-center gap-3 text-xs">
                            {d.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <span className="font-mono">{d.event}</span>
                            <Badge variant={d.status === "success" ? "secondary" : "destructive"} className="text-xs">{d.statusCode ?? d.status}</Badge>
                            <span className="text-muted-foreground ml-auto">{d.lastAttemptAt ? new Date(d.lastAttemptAt).toLocaleString() : "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
