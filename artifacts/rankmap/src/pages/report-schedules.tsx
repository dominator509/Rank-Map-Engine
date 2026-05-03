import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Clock, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReportSchedule {
  id: number; projectId: number; reportType: string; frequency: string;
  recipientEmails: string[]; isActive: boolean;
  lastSentAt?: string; nextSendAt?: string;
}
interface Project { id: number; name: string; }
interface Client { id: number; name: string; }

export default function ReportSchedules() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [reportType, setReportType] = useState("project_summary");
  const [frequency, setFrequency] = useState("weekly");
  const [emails, setEmails] = useState("");

  const { data: schedules = [], isLoading } = useQuery<ReportSchedule[]>({
    queryKey: ["/api/report-schedules"],
    queryFn: () => customFetch("/api/report-schedules"),
  });

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"], queryFn: () => customFetch("/api/clients") });
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/all-projects"],
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

  const create = useMutation({
    mutationFn: () => customFetch("/api/report-schedules", {
      method: "POST",
      body: JSON.stringify({
        projectId: parseInt(projectId, 10),
        reportType, frequency,
        recipientEmails: emails.split(",").map((e) => e.trim()).filter(Boolean),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      setOpen(false); setProjectId(""); setEmails("");
      toast({ title: "Schedule created" });
    },
    onError: (e: Error) => toast({ title: e.message || "Failed to create schedule", variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      customFetch(`/api/report-schedules/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/report-schedules"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => customFetch(`/api/report-schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      toast({ title: "Schedule deleted" });
    },
  });

  const projectMap = Object.fromEntries((allProjects as Project[]).map((p) => [p.id, p.name]));
  const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  const TYPE_LABELS: Record<string, string> = { project_summary: "Project Summary", topical_authority: "Topical Authority", content_pipeline: "Content Pipeline" };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Clock className="w-7 h-7" />Report Schedules</h1>
            <p className="text-muted-foreground mt-1">Automate report delivery to clients and stakeholders</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New Schedule</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Report Schedule</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Project</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                    <SelectContent>{(allProjects as Project[]).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(FREQ_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Recipients (comma-separated emails)</Label>
                  <Input placeholder="client@example.com, boss@agency.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
                </div>
                <Button className="w-full" onClick={() => create.mutate()} disabled={!projectId || !emails || create.isPending}>
                  Create Schedule
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <div className="h-40 bg-muted rounded animate-pulse" /> :
          (schedules as ReportSchedule[]).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
                <Clock className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No schedules yet</p>
                <p className="text-sm">Create a schedule to automate report delivery.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(schedules as ReportSchedule[]).map((s) => (
                <Card key={s.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch checked={s.isActive} onCheckedChange={(v) => toggle.mutate({ id: s.id, isActive: v })} />
                        <div>
                          <CardTitle className="text-base">{projectMap[s.projectId] ?? `Project ${s.projectId}`} — {TYPE_LABELS[s.reportType] ?? s.reportType}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline">{FREQ_LABELS[s.frequency]}</Badge>
                            <Mail className="w-3 h-3" />
                            {(s.recipientEmails as string[]).join(", ")}
                          </CardDescription>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(s.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {s.lastSentAt ? `Last sent: ${format(new Date(s.lastSentAt), "MMM d, yyyy HH:mm")}` : "Never sent"} ·{" "}
                      {s.nextSendAt ? `Next: ${format(new Date(s.nextSendAt), "MMM d, yyyy")}` : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
