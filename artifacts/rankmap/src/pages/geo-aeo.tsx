import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FilePlus2,
  FlaskConical,
  Play,
  PlusCircle,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

type GeoAeoAudit = {
  id: number;
  clientId: number;
  projectId: number | null;
  auditName: string;
  websiteUrl: string;
  niche: string;
  servicesOrProducts?: string[] | null;
  targetLocation?: string | null;
  targetAudience?: string | null;
  status: string;
  summary?: string | null;
  visibilityScore?: number | null;
  visibilityLabel?: string | null;
  approvedAt?: string | null;
  createdAt: string;
};

type Client = {
  id: number;
  name: string;
  domain?: string | null;
  industry?: string | null;
};

type Project = {
  id: number;
  clientId: number;
  name: string;
  targetDomain: string;
};

type GeoAeoPrompt = {
  id: number;
  promptText: string;
  intent?: string | null;
  funnelStage?: string | null;
  serviceOrProduct?: string | null;
  priority: number;
};

type GeoAeoSnapshot = {
  id: number;
  engine: string;
  captureMethod: string;
  answerText?: string;
  locationContext?: string | null;
  clientMentioned: boolean;
  clientCited: boolean;
  sentiment?: string | null;
  accuracyRiskScore?: number | null;
  capturedAt: string;
};

type GeoAeoManualRecord = {
  id: number;
  auditId: number;
  status?: string;
  name?: string;
  websiteUrl?: string | null;
  sourceName?: string;
  sourceUrl?: string | null;
  url?: string | null;
  pageUrl?: string | null;
  schemaType?: string | null;
  issueType?: string;
  severity?: string;
  priority?: string;
  recommendation?: string | null;
  reason?: string | null;
  createdAt?: string;
};

type GeoAeoFinding = {
  id: number;
  findingType: string;
  severity: string;
  title: string;
  description?: string | null;
  recommendation?: string | null;
  status: string;
};

type GeoAeoActionPlan = {
  plan: {
    id: number;
    name: string;
    summary?: string | null;
    status: string;
  };
  items: Array<{
    id: number;
    title: string;
    description?: string | null;
    category: string;
    priority: string;
    weekNumber: number;
    status: string;
  }>;
};

type GeoAeoReport = {
  id: number;
  type: string;
  format: string;
  generatedAt?: string | null;
  createdAt: string;
};

type GeoAeoMonitoringRun = {
  id: number;
  auditId: number;
  runMonth: string;
  baselineMonth?: string | null;
  comparisonMonth: string;
  status: string;
  baselineScore?: number | null;
  currentScore?: number | null;
  scoreDelta?: number | null;
  baselineSnapshotCount: number;
  currentSnapshotCount: number;
  summary?: string | null;
  approvedAt?: string | null;
};

type ClientAuditDetail = {
  audit: GeoAeoAudit;
  findings: GeoAeoFinding[];
  actionPlan: GeoAeoActionPlan | null;
  reports: GeoAeoReport[];
  monitoringRuns?: GeoAeoMonitoringRun[];
};

const ENGINES = ["chatgpt", "gemini", "perplexity", "google_ai_overviews"] as const;
const ACTION_CATEGORIES = [
  "entity_clarity",
  "website_content",
  "faq_schema",
  "service_page",
  "location_page",
  "source_citation",
  "review_proof",
  "competitor_gap",
  "measurement",
  "manual_review",
] as const;

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "done"
      ? "bg-green-500/10 text-green-600 border-green-200"
      : status === "in_review" || status === "needs_review" || status === "in_progress"
        ? "bg-amber-500/10 text-amber-600 border-amber-200"
        : status === "rejected" || status === "deleted"
          ? "bg-red-500/10 text-red-600 border-red-200"
          : "bg-slate-500/10 text-slate-600 border-slate-200";

  return (
    <Badge variant="outline" className={`capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function ScoreCard({ audit }: { audit: GeoAeoAudit }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>AI Visibility Score</CardDescription>
        <CardTitle className="flex items-end gap-2 text-4xl">
          {audit.visibilityScore ?? "-"}
          {audit.visibilityLabel && <span className="pb-1 text-sm font-medium">{audit.visibilityLabel}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {audit.websiteUrl} · {audit.niche}
      </CardContent>
    </Card>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function GeoAeo() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isClientUser = user?.user.role === "client";
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [promptCsv, setPromptCsv] = useState("");
  const [snapshotCsv, setSnapshotCsv] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [citationSourceName, setCitationSourceName] = useState("");
  const [citationUrl, setCitationUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [schemaIssueType, setSchemaIssueType] = useState("");
  const [schemaPageUrl, setSchemaPageUrl] = useState("");
  const [monitoringRunMonth, setMonitoringRunMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [monitoringBaselineMonth, setMonitoringBaselineMonth] = useState("");
  const [monitoringBaselineScore, setMonitoringBaselineScore] = useState("");
  const [monitoringCurrentScore, setMonitoringCurrentScore] = useState("");
  const [actionItemTitle, setActionItemTitle] = useState("");
  const [actionItemDescription, setActionItemDescription] = useState("");
  const [actionItemCategory, setActionItemCategory] = useState("manual_review");
  const [actionItemPriority, setActionItemPriority] = useState("medium");
  const [actionItemWeek, setActionItemWeek] = useState("1");
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [competitorDrafts, setCompetitorDrafts] = useState<Record<number, { name: string; websiteUrl: string }>>({});
  const [sourceDrafts, setSourceDrafts] = useState<
    Record<number, { sourceName: string; sourceUrl: string; status: string }>
  >({});
  const [schemaDrafts, setSchemaDrafts] = useState<
    Record<number, { issueType: string; pageUrl: string; status: string }>
  >({});
  const [actionItemDrafts, setActionItemDrafts] = useState<
    Record<
      number,
      {
        title: string;
        description: string;
        category: string;
        priority: string;
        weekNumber: string;
        status: string;
      }
    >
  >({});

  const operatorAudits = useQuery<GeoAeoAudit[]>({
    queryKey: ["/api/geo-aeo/audits"],
    queryFn: () => customFetch("/api/geo-aeo/audits"),
    enabled: !isClientUser,
  });

  const clientAudits = useQuery<GeoAeoAudit[]>({
    queryKey: ["/api/geo-aeo/client/audits"],
    queryFn: () => customFetch("/api/geo-aeo/client/audits"),
    enabled: isClientUser,
  });

  const audits = isClientUser ? clientAudits.data : operatorAudits.data;
  const isLoadingAudits = isClientUser ? clientAudits.isLoading : operatorAudits.isLoading;
  const selectedAudit = useMemo(
    () => audits?.find((audit) => audit.id === selectedAuditId) ?? audits?.[0] ?? null,
    [audits, selectedAuditId],
  );
  const auditId = selectedAudit?.id ?? 0;

  const clients = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => customFetch("/api/clients"),
    enabled: !isClientUser,
  });

  const projects = useQuery<Project[]>({
    queryKey: ["/api/geo-aeo/projects", clients.data?.map((client) => client.id).join(",")],
    queryFn: async () => {
      const projectLists = await Promise.all(
        (clients.data ?? []).map((client) =>
          customFetch<Project[]>(`/api/clients/${client.id}/projects`),
        ),
      );
      return projectLists.flat();
    },
    enabled: !isClientUser && Boolean(clients.data?.length),
  });

  const prompts = useQuery<GeoAeoPrompt[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "prompts"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/prompts`),
    enabled: !isClientUser && auditId > 0,
  });

  const snapshots = useQuery<GeoAeoSnapshot[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "snapshots"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/snapshots`),
    enabled: !isClientUser && auditId > 0,
  });

  const findings = useQuery<GeoAeoFinding[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "findings"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/findings`),
    enabled: !isClientUser && auditId > 0,
  });

  const competitors = useQuery<GeoAeoManualRecord[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "competitors"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/competitors`),
    enabled: !isClientUser && auditId > 0,
  });

  const citations = useQuery<GeoAeoManualRecord[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "citations"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/citations`),
    enabled: !isClientUser && auditId > 0,
  });

  const sourceRecommendations = useQuery<GeoAeoManualRecord[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "source-recommendations"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/source-recommendations`),
    enabled: !isClientUser && auditId > 0,
  });

  const schemaFindings = useQuery<GeoAeoManualRecord[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "schema-findings"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/schema-findings`),
    enabled: !isClientUser && auditId > 0,
  });

  const monitoringRuns = useQuery<GeoAeoMonitoringRun[]>({
    queryKey: ["/api/geo-aeo/audits", auditId, "monitoring-runs"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/monitoring-runs`),
    enabled: !isClientUser && auditId > 0,
  });

  const actionPlan = useQuery<GeoAeoActionPlan | null>({
    queryKey: ["/api/geo-aeo/audits", auditId, "action-plan"],
    queryFn: () => customFetch(`/api/geo-aeo/audits/${auditId}/action-plan`),
    enabled: !isClientUser && auditId > 0,
  });

  const projectReports = useQuery<GeoAeoReport[]>({
    queryKey: ["/api/projects", selectedAudit?.projectId, "reports", "geo-aeo"],
    queryFn: async () => {
      const reports = await customFetch<GeoAeoReport[]>(
        `/api/projects/${selectedAudit?.projectId}/reports`,
      );
      return reports.filter((report) => report.type === "geo_aeo_visibility_audit");
    },
    enabled: !isClientUser && Boolean(selectedAudit?.projectId),
  });

  const clientDetail = useQuery<ClientAuditDetail>({
    queryKey: ["/api/geo-aeo/client/audits", auditId],
    queryFn: () => customFetch(`/api/geo-aeo/client/audits/${auditId}`),
    enabled: isClientUser && auditId > 0,
  });

  const invalidateAudit = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits"] });
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedAudit?.projectId, "reports", "geo-aeo"] });
  };

  const invalidateManualFallback = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "snapshots"] });
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "competitors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "citations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "source-recommendations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "schema-findings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "monitoring-runs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/client/audits", auditId] });
  };

  const createAudit = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      customFetch("/api/geo-aeo/audits", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidateAudit();
      setIsCreateOpen(false);
      toast({ title: "GEO/AEO audit created" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const simpleAuditMutation = (path: string, title: string, body: Record<string, unknown> = {}) =>
    customFetch(path, { method: "POST", body: JSON.stringify(body) }).then(() => {
      invalidateAudit();
      toast({ title });
    });

  const analyzeAudit = useMutation({
    mutationFn: () => simpleAuditMutation(`/api/geo-aeo/audits/${auditId}/analyze`, "Analysis complete"),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const generateActionPlan = useMutation({
    mutationFn: () =>
      simpleAuditMutation(`/api/geo-aeo/audits/${auditId}/action-plan/generate`, "Action plan generated"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "action-plan"] }),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createActionItem = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/action-items`, {
        method: "POST",
        body: JSON.stringify({
          title: actionItemTitle,
          description: actionItemDescription || undefined,
          category: actionItemCategory,
          priority: actionItemPriority,
          weekNumber: Number(actionItemWeek),
          status: "draft",
        }),
      }),
    onSuccess: () => {
      setActionItemTitle("");
      setActionItemDescription("");
      setActionItemCategory("manual_review");
      setActionItemPriority("medium");
      setActionItemWeek("1");
      queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "action-plan"] });
      toast({ title: "Action item added" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const generateReport = useMutation({
    mutationFn: (format: "markdown" | "pdf") =>
      simpleAuditMutation(`/api/geo-aeo/audits/${auditId}/report/generate`, "Report generated", {
        format,
      }),
    onSuccess: () => projectReports.refetch(),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const importPrompts = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/prompts/import`, {
        method: "POST",
        body: JSON.stringify({ csvText: promptCsv }),
      }),
    onSuccess: () => {
      setPromptCsv("");
      queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "prompts"] });
      toast({ title: "Prompts imported" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const importSnapshots = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/snapshots/import-csv`, {
        method: "POST",
        body: JSON.stringify({ csvText: snapshotCsv }),
      }),
    onSuccess: () => {
      setSnapshotCsv("");
      queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "snapshots"] });
      toast({ title: "Snapshots imported" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const updateSnapshotFlags = useMutation({
    mutationFn: ({
      snapshotId,
      clientMentioned,
      clientCited,
    }: {
      snapshotId: number;
      clientMentioned: boolean;
      clientCited: boolean;
    }) =>
      customFetch(`/api/geo-aeo/snapshots/${snapshotId}`, {
        method: "PATCH",
        body: JSON.stringify({ clientMentioned, clientCited }),
      }),
    onSuccess: () => {
      invalidateManualFallback();
      toast({ title: "Snapshot markings updated" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const overrideVisibilityScore = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/score`, {
        method: "POST",
        body: JSON.stringify({
          score: Number(overrideScore),
          reason: overrideReason,
        }),
      }),
    onSuccess: () => {
      setOverrideScore("");
      setOverrideReason("");
      invalidateAudit();
      toast({ title: "Score override saved" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createCompetitor = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/competitors`, {
        method: "POST",
        body: JSON.stringify({
          name: competitorName,
          websiteUrl: competitorUrl || undefined,
        }),
      }),
    onSuccess: () => {
      setCompetitorName("");
      setCompetitorUrl("");
      invalidateManualFallback();
      toast({ title: "Competitor added" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const updateCompetitor = useMutation({
    mutationFn: ({ competitorId, name, websiteUrl }: { competitorId: number; name: string; websiteUrl: string }) =>
      customFetch(`/api/geo-aeo/competitors/${competitorId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          websiteUrl: websiteUrl || undefined,
        }),
      }),
    onSuccess: (_data, variables) => {
      setCompetitorDrafts((drafts) => {
        const next = { ...drafts };
        delete next[variables.competitorId];
        return next;
      });
      invalidateManualFallback();
      toast({ title: "Competitor updated" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const deleteCompetitor = useMutation({
    mutationFn: (competitorId: number) =>
      customFetch(`/api/geo-aeo/competitors/${competitorId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateManualFallback();
      toast({ title: "Competitor removed" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createCitation = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/citations`, {
        method: "POST",
        body: JSON.stringify({
          sourceName: citationSourceName || undefined,
          url: citationUrl || undefined,
          isClientOwned: true,
        }),
      }),
    onSuccess: () => {
      setCitationSourceName("");
      setCitationUrl("");
      invalidateManualFallback();
      toast({ title: "Citation added" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const deleteCitation = useMutation({
    mutationFn: (citationId: number) =>
      customFetch(`/api/geo-aeo/citations/${citationId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateManualFallback();
      toast({ title: "Citation removed" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createSourceRecommendation = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/source-recommendations`, {
        method: "POST",
        body: JSON.stringify({
          sourceName,
          sourceUrl: sourceUrl || undefined,
          priority: "medium",
          status: "draft",
        }),
      }),
    onSuccess: () => {
      setSourceName("");
      setSourceUrl("");
      invalidateManualFallback();
      toast({ title: "Source recommendation added" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const updateSourceRecommendation = useMutation({
    mutationFn: ({
      sourceRecommendationId,
      sourceName,
      sourceUrl,
      status,
    }: {
      sourceRecommendationId: number;
      sourceName: string;
      sourceUrl: string;
      status: string;
    }) =>
      customFetch(`/api/geo-aeo/source-recommendations/${sourceRecommendationId}`, {
        method: "PATCH",
        body: JSON.stringify({
          sourceName,
          sourceUrl: sourceUrl || undefined,
          status,
        }),
      }),
    onSuccess: (_data, variables) => {
      setSourceDrafts((drafts) => {
        const next = { ...drafts };
        delete next[variables.sourceRecommendationId];
        return next;
      });
      invalidateManualFallback();
      toast({ title: "Source recommendation updated" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const deleteSourceRecommendation = useMutation({
    mutationFn: (sourceRecommendationId: number) =>
      customFetch(`/api/geo-aeo/source-recommendations/${sourceRecommendationId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateManualFallback();
      toast({ title: "Source recommendation removed" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createSchemaFinding = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/schema-findings`, {
        method: "POST",
        body: JSON.stringify({
          issueType: schemaIssueType,
          pageUrl: schemaPageUrl || undefined,
          severity: "medium",
          status: "draft",
        }),
      }),
    onSuccess: () => {
      setSchemaIssueType("");
      setSchemaPageUrl("");
      invalidateManualFallback();
      toast({ title: "Schema finding added" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const updateSchemaFinding = useMutation({
    mutationFn: ({
      schemaFindingId,
      issueType,
      pageUrl,
      status,
    }: {
      schemaFindingId: number;
      issueType: string;
      pageUrl: string;
      status: string;
    }) =>
      customFetch(`/api/geo-aeo/schema-findings/${schemaFindingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          issueType,
          pageUrl: pageUrl || undefined,
          status,
        }),
      }),
    onSuccess: (_data, variables) => {
      setSchemaDrafts((drafts) => {
        const next = { ...drafts };
        delete next[variables.schemaFindingId];
        return next;
      });
      invalidateManualFallback();
      toast({ title: "Schema finding updated" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const deleteSchemaFinding = useMutation({
    mutationFn: (schemaFindingId: number) =>
      customFetch(`/api/geo-aeo/schema-findings/${schemaFindingId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateManualFallback();
      toast({ title: "Schema finding removed" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createMonitoringRun = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}/monitoring-runs`, {
        method: "POST",
        body: JSON.stringify({
          runMonth: monitoringRunMonth,
          baselineMonth: monitoringBaselineMonth || undefined,
          baselineScore: monitoringBaselineScore ? Number(monitoringBaselineScore) : undefined,
          currentScore: monitoringCurrentScore ? Number(monitoringCurrentScore) : undefined,
          currentSnapshotCount: snapshots.data?.length ?? 0,
        }),
      }),
    onSuccess: () => {
      setMonitoringBaselineScore("");
      setMonitoringCurrentScore("");
      invalidateManualFallback();
      toast({ title: "Monitoring run created" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const approveMonitoringRun = useMutation({
    mutationFn: (monitoringRunId: number) =>
      customFetch(`/api/geo-aeo/monitoring-runs/${monitoringRunId}/approve`, { method: "POST" }),
    onSuccess: () => {
      invalidateManualFallback();
      toast({ title: "Monitoring run approved" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const approveAudit = useMutation({
    mutationFn: () =>
      customFetch(`/api/geo-aeo/audits/${auditId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
    onSuccess: () => {
      invalidateAudit();
      toast({ title: "Audit approved" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const approveFinding = useMutation({
    mutationFn: (findingId: number) =>
      customFetch(`/api/geo-aeo/findings/${findingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "findings"] });
      toast({ title: "Finding approved" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const approveActionItem = useMutation({
    mutationFn: (actionItemId: number) =>
      customFetch(`/api/geo-aeo/action-items/${actionItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "action-plan"] });
      toast({ title: "Action approved" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const updateActionItem = useMutation({
    mutationFn: ({
      actionItemId,
      title,
      description,
      category,
      priority,
      weekNumber,
      status,
    }: {
      actionItemId: number;
      title: string;
      description: string;
      category: string;
      priority: string;
      weekNumber: string;
      status: string;
    }) =>
      customFetch(`/api/geo-aeo/action-items/${actionItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description: description || undefined,
          category,
          priority,
          weekNumber: Number(weekNumber),
          status,
        }),
      }),
    onSuccess: (_data, variables) => {
      setActionItemDrafts((drafts) => {
        const next = { ...drafts };
        delete next[variables.actionItemId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "action-plan"] });
      toast({ title: "Action item updated" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const deleteActionItem = useMutation({
    mutationFn: (actionItemId: number) =>
      customFetch(`/api/geo-aeo/action-items/${actionItemId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/geo-aeo/audits", auditId, "action-plan"] });
      toast({ title: "Action item removed" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const exportReport = useMutation({
    mutationFn: async ({ reportId, format }: { reportId: number; format: string }) => {
      const blob = await customFetch<Blob>(`/api/geo-aeo/reports/${reportId}/export`, {
        method: "POST",
        body: JSON.stringify({ format: format === "pdf" ? "pdf" : "markdown" }),
        responseType: "blob",
      });
      downloadBlob(blob, `geo-aeo-report-${reportId}.${format === "pdf" ? "pdf" : "md"}`);
    },
    onSuccess: () => toast({ title: "Report downloaded" }),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const projectValue = formData.get("projectId") as string;
    createAudit.mutate({
      clientId: Number(formData.get("clientId")),
      projectId: projectValue && projectValue !== "none" ? Number(projectValue) : undefined,
      auditName: formData.get("auditName"),
      websiteUrl: formData.get("websiteUrl"),
      niche: formData.get("niche"),
      servicesOrProducts: String(formData.get("servicesOrProducts") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      targetLocation: formData.get("targetLocation") || undefined,
      targetAudience: formData.get("targetAudience") || undefined,
      businessFacts: {},
      targetEngines: ENGINES,
    });
  };

  const visibleReports = isClientUser ? clientDetail.data?.reports : projectReports.data;
  const visibleFindings = isClientUser ? clientDetail.data?.findings : findings.data;
  const visibleActionPlan = isClientUser ? clientDetail.data?.actionPlan : actionPlan.data;
  const visibleMonitoringRuns = isClientUser ? clientDetail.data?.monitoringRuns : monitoringRuns.data;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <FlaskConical className="h-7 w-7" />
              GEO/AEO Visibility
            </h1>
            <p className="mt-1 text-muted-foreground">Manual answer-engine audits and approvals</p>
          </div>
          {!isClientUser && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  New Audit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>New GEO/AEO Audit</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select name="clientId" required value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {(clients.data ?? []).map((client) => (
                            <SelectItem key={client.id} value={String(client.id)}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Project</Label>
                      <Select name="projectId" defaultValue="none">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No linked project</SelectItem>
                          {(projects.data ?? [])
                            .filter((project) => !selectedClientId || project.clientId === Number(selectedClientId))
                            .map((project) => (
                              <SelectItem key={project.id} value={String(project.id)}>
                                {project.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="auditName">Audit Name</Label>
                      <Input id="auditName" name="auditName" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="websiteUrl">Website URL</Label>
                      <Input id="websiteUrl" name="websiteUrl" required placeholder="https://example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="niche">Niche</Label>
                      <Input id="niche" name="niche" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetLocation">Target Location</Label>
                      <Input id="targetLocation" name="targetLocation" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="servicesOrProducts">Services or Products</Label>
                      <Input id="servicesOrProducts" name="servicesOrProducts" required />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="targetAudience">Target Audience</Label>
                      <Input id="targetAudience" name="targetAudience" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createAudit.isPending}>
                      Create Audit
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Audits</CardTitle>
              <CardDescription>{audits?.length ?? 0} visible</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingAudits ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16" />)
              ) : !audits?.length ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No GEO/AEO audits yet.
                </div>
              ) : (
                audits.map((audit) => (
                  <button
                    key={audit.id}
                    type="button"
                    onClick={() => setSelectedAuditId(audit.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selectedAudit?.id === audit.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{audit.auditName}</span>
                      <StatusBadge status={audit.status} />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{audit.websiteUrl}</div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {!selectedAudit ? (
            <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground">
              Select an audit to view the workspace.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard audit={selectedAudit} />
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Prompts</CardDescription>
                    <CardTitle className="text-4xl">{prompts.data?.length ?? 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {snapshots.data?.length ?? 0} answer snapshots
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Findings</CardDescription>
                    <CardTitle className="text-4xl">{visibleFindings?.length ?? 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {visibleActionPlan?.items.length ?? 0} action items
                  </CardContent>
                </Card>
              </div>

              {!isClientUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Score Override</CardTitle>
                    <CardDescription>Manual score changes require an operator reason and are audited.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="geoAeoOverrideScore">Score</Label>
                      <Input
                        id="geoAeoOverrideScore"
                        data-testid="geo-aeo-override-score"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={overrideScore}
                        onChange={(event) => setOverrideScore(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="geoAeoOverrideReason">Reason</Label>
                      <Input
                        id="geoAeoOverrideReason"
                        data-testid="geo-aeo-override-reason"
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        placeholder="Operator review reason"
                      />
                    </div>
                    <Button
                      data-testid="geo-aeo-save-score-override"
                      variant="outline"
                      onClick={() => overrideVisibilityScore.mutate()}
                      disabled={
                        !overrideScore ||
                        Number.isNaN(Number(overrideScore)) ||
                        overrideReason.trim().length < 10 ||
                        overrideVisibilityScore.isPending
                      }
                    >
                      Save Override
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!isClientUser && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="geo-aeo-analyze"
                    onClick={() => analyzeAudit.mutate()}
                    disabled={analyzeAudit.isPending}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Analyze
                  </Button>
                  <Button
                    data-testid="geo-aeo-action-plan"
                    variant="outline"
                    onClick={() => generateActionPlan.mutate()}
                    disabled={generateActionPlan.isPending}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Action Plan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateReport.mutate("markdown")}
                    disabled={generateReport.isPending || !selectedAudit.projectId}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Report
                  </Button>
                  <Button
                    data-testid="geo-aeo-report-pdf"
                    variant="outline"
                    onClick={() => generateReport.mutate("pdf")}
                    disabled={generateReport.isPending || !selectedAudit.projectId}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button
                    data-testid="geo-aeo-approve-audit"
                    variant="outline"
                    onClick={() => approveAudit.mutate()}
                    disabled={approveAudit.isPending || selectedAudit.status === "approved"}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Approve Audit
                  </Button>
                </div>
              )}

              {!isClientUser && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Prompt CSV</CardTitle>
                      <CardDescription>Columns: promptText, intent, funnelStage, serviceOrProduct, location, priority</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        data-testid="geo-aeo-prompt-csv"
                        value={promptCsv}
                        onChange={(event) => setPromptCsv(event.target.value)}
                        className="min-h-28"
                      />
                      <Button
                        data-testid="geo-aeo-import-prompts"
                        size="sm"
                        onClick={() => importPrompts.mutate()}
                        disabled={!promptCsv || importPrompts.isPending}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import Prompts
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Snapshot CSV</CardTitle>
                      <CardDescription>Columns: promptId, engine, captureMethod, answerText, capturedAt, locationContext</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        data-testid="geo-aeo-snapshot-csv"
                        value={snapshotCsv}
                        onChange={(event) => setSnapshotCsv(event.target.value)}
                        className="min-h-28"
                      />
                      <Button
                        data-testid="geo-aeo-import-snapshots"
                        size="sm"
                        onClick={() => importSnapshots.mutate()}
                        disabled={!snapshotCsv || importSnapshots.isPending}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import Snapshots
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {!isClientUser && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Snapshot Marking</CardTitle>
                      <CardDescription>Flag pasted answers for client mentions and client-owned citations.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!snapshots.data?.length ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          No answer snapshots available.
                        </div>
                      ) : (
                        snapshots.data.slice(0, 6).map((snapshot) => (
                          <div key={snapshot.id} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-medium capitalize">{snapshot.engine.replace(/_/g, " ")}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(snapshot.capturedAt).toLocaleString()}
                                  {snapshot.locationContext ? ` · ${snapshot.locationContext}` : ""}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant={snapshot.clientMentioned ? "default" : "outline"}
                                  onClick={() =>
                                    updateSnapshotFlags.mutate({
                                      snapshotId: snapshot.id,
                                      clientMentioned: !snapshot.clientMentioned,
                                      clientCited: snapshot.clientCited,
                                    })
                                  }
                                >
                                  Mention
                                </Button>
                                <Button
                                  size="sm"
                                  variant={snapshot.clientCited ? "default" : "outline"}
                                  onClick={() =>
                                    updateSnapshotFlags.mutate({
                                      snapshotId: snapshot.id,
                                      clientMentioned: snapshot.clientMentioned,
                                      clientCited: !snapshot.clientCited,
                                    })
                                  }
                                >
                                  Cited
                                </Button>
                              </div>
                            </div>
                            {snapshot.answerText && (
                              <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                {snapshot.answerText}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Monitoring Runs</CardTitle>
                      <CardDescription>Manual monthly progress records stay draft until approved.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="monitoringRunMonth">Run Month</Label>
                          <Input
                            id="monitoringRunMonth"
                            type="month"
                            value={monitoringRunMonth}
                            onChange={(event) => setMonitoringRunMonth(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="monitoringBaselineMonth">Baseline Month</Label>
                          <Input
                            id="monitoringBaselineMonth"
                            type="month"
                            value={monitoringBaselineMonth}
                            onChange={(event) => setMonitoringBaselineMonth(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="monitoringBaselineScore">Baseline Score</Label>
                          <Input
                            id="monitoringBaselineScore"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={monitoringBaselineScore}
                            onChange={(event) => setMonitoringBaselineScore(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="monitoringCurrentScore">Current Score</Label>
                          <Input
                            id="monitoringCurrentScore"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={monitoringCurrentScore}
                            onChange={(event) => setMonitoringCurrentScore(event.target.value)}
                          />
                        </div>
                      </div>
                      <Button
                        data-testid="geo-aeo-add-monitoring-run"
                        size="sm"
                        onClick={() => createMonitoringRun.mutate()}
                        disabled={!monitoringRunMonth || createMonitoringRun.isPending}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Run
                      </Button>
                      <div className="space-y-2">
                        {!monitoringRuns.data?.length ? (
                          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No monitoring runs yet.
                          </div>
                        ) : (
                          monitoringRuns.data.map((run) => (
                            <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                              <div>
                                <div className="font-medium">{run.runMonth}</div>
                                <div className="text-sm text-muted-foreground">
                                  {run.baselineScore ?? "-"} {"->"} {run.currentScore ?? "-"}
                                  {run.scoreDelta !== null && run.scoreDelta !== undefined
                                    ? ` (${run.scoreDelta > 0 ? "+" : ""}${run.scoreDelta})`
                                    : ""}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={run.status} />
                                {run.status !== "approved" && (
                                  <Button
                                    data-testid="geo-aeo-approve-monitoring-run"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => approveMonitoringRun.mutate(run.id)}
                                  >
                                    Approve
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {!isClientUser && (
                <div className="grid gap-4 xl:grid-cols-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Competitors</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        value={competitorName}
                        onChange={(event) => setCompetitorName(event.target.value)}
                        placeholder="Competitor name"
                      />
                      <Input
                        value={competitorUrl}
                        onChange={(event) => setCompetitorUrl(event.target.value)}
                        placeholder="https://competitor.com"
                      />
                      <Button
                        data-testid="geo-aeo-add-competitor"
                        size="sm"
                        onClick={() => createCompetitor.mutate()}
                        disabled={!competitorName || createCompetitor.isPending}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                      <div className="space-y-2">
                        {(competitors.data ?? []).slice(0, 5).map((competitor) => {
                          const draft = competitorDrafts[competitor.id] ?? {
                            name: competitor.name ?? "",
                            websiteUrl: competitor.websiteUrl ?? "",
                          };
                          return (
                            <div key={competitor.id} className="space-y-2 rounded-md border p-2 text-sm">
                              <Input
                                value={draft.name}
                                onChange={(event) =>
                                  setCompetitorDrafts((drafts) => ({
                                    ...drafts,
                                    [competitor.id]: { ...draft, name: event.target.value },
                                  }))
                                }
                                aria-label="Competitor name"
                              />
                              <Input
                                value={draft.websiteUrl}
                                onChange={(event) =>
                                  setCompetitorDrafts((drafts) => ({
                                    ...drafts,
                                    [competitor.id]: { ...draft, websiteUrl: event.target.value },
                                  }))
                                }
                                placeholder="https://competitor.com"
                                aria-label="Competitor URL"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  data-testid="geo-aeo-save-competitor"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateCompetitor.mutate({
                                      competitorId: competitor.id,
                                      name: draft.name,
                                      websiteUrl: draft.websiteUrl,
                                    })
                                  }
                                  disabled={!draft.name || updateCompetitor.isPending}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteCompetitor.mutate(competitor.id)}
                                  disabled={deleteCompetitor.isPending}
                                  aria-label="Remove competitor"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Citations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        value={citationSourceName}
                        onChange={(event) => setCitationSourceName(event.target.value)}
                        placeholder="Source name"
                      />
                      <Input
                        value={citationUrl}
                        onChange={(event) => setCitationUrl(event.target.value)}
                        placeholder="https://source.com/page"
                      />
                      <Button
                        data-testid="geo-aeo-add-citation"
                        size="sm"
                        onClick={() => createCitation.mutate()}
                        disabled={(!citationSourceName && !citationUrl) || createCitation.isPending}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                      <div className="space-y-2">
                        {(citations.data ?? []).slice(0, 5).map((citation) => (
                          <div key={citation.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{citation.sourceName || citation.url}</div>
                              {citation.url && <div className="truncate text-muted-foreground">{citation.url}</div>}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteCitation.mutate(citation.id)}
                              aria-label="Remove citation"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Source Targets</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        value={sourceName}
                        onChange={(event) => setSourceName(event.target.value)}
                        placeholder="Source name"
                      />
                      <Input
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                        placeholder="https://directory.com/profile"
                      />
                      <Button
                        data-testid="geo-aeo-add-source-recommendation"
                        size="sm"
                        onClick={() => createSourceRecommendation.mutate()}
                        disabled={!sourceName || createSourceRecommendation.isPending}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                      <div className="space-y-2">
                        {(sourceRecommendations.data ?? []).slice(0, 5).map((source) => {
                          const draft = sourceDrafts[source.id] ?? {
                            sourceName: source.sourceName ?? "",
                            sourceUrl: source.sourceUrl ?? "",
                            status: source.status ?? "draft",
                          };
                          return (
                            <div key={source.id} className="space-y-2 rounded-md border p-2 text-sm">
                              <Input
                                value={draft.sourceName}
                                onChange={(event) =>
                                  setSourceDrafts((drafts) => ({
                                    ...drafts,
                                    [source.id]: { ...draft, sourceName: event.target.value },
                                  }))
                                }
                                aria-label="Source target name"
                              />
                              <Input
                                value={draft.sourceUrl}
                                onChange={(event) =>
                                  setSourceDrafts((drafts) => ({
                                    ...drafts,
                                    [source.id]: { ...draft, sourceUrl: event.target.value },
                                  }))
                                }
                                placeholder="https://directory.com/profile"
                                aria-label="Source target URL"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={draft.status}
                                  onValueChange={(status) =>
                                    setSourceDrafts((drafts) => ({
                                      ...drafts,
                                      [source.id]: { ...draft, status },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-9 w-32" aria-label="Source target status">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  data-testid="geo-aeo-save-source-recommendation"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateSourceRecommendation.mutate({
                                      sourceRecommendationId: source.id,
                                      sourceName: draft.sourceName,
                                      sourceUrl: draft.sourceUrl,
                                      status: draft.status,
                                    })
                                  }
                                  disabled={!draft.sourceName || updateSourceRecommendation.isPending}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteSourceRecommendation.mutate(source.id)}
                                  disabled={deleteSourceRecommendation.isPending}
                                  aria-label="Remove source recommendation"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Schema Findings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        value={schemaIssueType}
                        onChange={(event) => setSchemaIssueType(event.target.value)}
                        placeholder="Missing FAQPage"
                      />
                      <Input
                        value={schemaPageUrl}
                        onChange={(event) => setSchemaPageUrl(event.target.value)}
                        placeholder="https://site.com/page"
                      />
                      <Button
                        data-testid="geo-aeo-add-schema-finding"
                        size="sm"
                        onClick={() => createSchemaFinding.mutate()}
                        disabled={!schemaIssueType || createSchemaFinding.isPending}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                      <div className="space-y-2">
                        {(schemaFindings.data ?? []).slice(0, 5).map((schemaFinding) => {
                          const draft = schemaDrafts[schemaFinding.id] ?? {
                            issueType: schemaFinding.issueType ?? "",
                            pageUrl: schemaFinding.pageUrl ?? "",
                            status: schemaFinding.status ?? "draft",
                          };
                          return (
                            <div key={schemaFinding.id} className="space-y-2 rounded-md border p-2 text-sm">
                              <Input
                                value={draft.issueType}
                                onChange={(event) =>
                                  setSchemaDrafts((drafts) => ({
                                    ...drafts,
                                    [schemaFinding.id]: { ...draft, issueType: event.target.value },
                                  }))
                                }
                                aria-label="Schema issue"
                              />
                              <Input
                                value={draft.pageUrl}
                                onChange={(event) =>
                                  setSchemaDrafts((drafts) => ({
                                    ...drafts,
                                    [schemaFinding.id]: { ...draft, pageUrl: event.target.value },
                                  }))
                                }
                                placeholder="https://site.com/page"
                                aria-label="Schema page URL"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={draft.status}
                                  onValueChange={(status) =>
                                    setSchemaDrafts((drafts) => ({
                                      ...drafts,
                                      [schemaFinding.id]: { ...draft, status },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-9 w-32" aria-label="Schema finding status">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  data-testid="geo-aeo-save-schema-finding"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateSchemaFinding.mutate({
                                      schemaFindingId: schemaFinding.id,
                                      issueType: draft.issueType,
                                      pageUrl: draft.pageUrl,
                                      status: draft.status,
                                    })
                                  }
                                  disabled={!draft.issueType || updateSchemaFinding.isPending}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteSchemaFinding.mutate(schemaFinding.id)}
                                  disabled={deleteSchemaFinding.isPending}
                                  aria-label="Remove schema finding"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Findings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!visibleFindings?.length ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No findings available.
                    </div>
                  ) : (
                    visibleFindings.map((finding) => (
                      <div key={finding.id} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{finding.title}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{finding.recommendation}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={finding.status} />
                            {!isClientUser && finding.status !== "approved" && (
                              <Button size="sm" variant="outline" onClick={() => approveFinding.mutate(finding.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Action Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!isClientUser && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="grid gap-3 lg:grid-cols-[1fr_130px_130px_100px_auto] lg:items-end">
                        <div className="space-y-2">
                          <Label htmlFor="geoAeoActionItemTitle">Title</Label>
                          <Input
                            id="geoAeoActionItemTitle"
                            data-testid="geo-aeo-action-item-title"
                            value={actionItemTitle}
                            onChange={(event) => setActionItemTitle(event.target.value)}
                            placeholder="Add FAQ answers for service pages"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select value={actionItemCategory} onValueChange={setActionItemCategory}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={actionItemPriority} onValueChange={setActionItemPriority}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="geoAeoActionItemWeek">Week</Label>
                          <Input
                            id="geoAeoActionItemWeek"
                            type="number"
                            min="1"
                            max="4"
                            value={actionItemWeek}
                            onChange={(event) => setActionItemWeek(event.target.value)}
                          />
                        </div>
                        <Button
                          data-testid="geo-aeo-add-action-item"
                          size="sm"
                          onClick={() => createActionItem.mutate()}
                          disabled={!actionItemTitle || createActionItem.isPending}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Item
                        </Button>
                      </div>
                      <Textarea
                        value={actionItemDescription}
                        onChange={(event) => setActionItemDescription(event.target.value)}
                        placeholder="Optional implementation notes"
                        className="min-h-20"
                      />
                    </div>
                  )}
                  {!visibleActionPlan?.items.length ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No action items available.
                    </div>
                  ) : (
                    visibleActionPlan.items.map((item) => {
                      const draft = actionItemDrafts[item.id] ?? {
                        title: item.title,
                        description: item.description ?? "",
                        category: item.category,
                        priority: item.priority,
                        weekNumber: String(item.weekNumber),
                        status: item.status,
                      };

                      if (isClientUser) {
                        return (
                          <div key={item.id} className="rounded-lg border p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-medium">Week {item.weekNumber}: {item.title}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                              </div>
                              <StatusBadge status={item.status} />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={item.id} className="space-y-3 rounded-lg border p-4">
                          <div className="grid gap-3 lg:grid-cols-[1fr_130px_130px_100px_130px] lg:items-end">
                            <div className="space-y-2">
                              <Label>Title</Label>
                              <Input
                                data-testid="geo-aeo-existing-action-title"
                                value={draft.title}
                                onChange={(event) =>
                                  setActionItemDrafts((drafts) => ({
                                    ...drafts,
                                    [item.id]: { ...draft, title: event.target.value },
                                  }))
                                }
                                aria-label="Action item title"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Category</Label>
                              <Select
                                value={draft.category}
                                onValueChange={(category) =>
                                  setActionItemDrafts((drafts) => ({
                                    ...drafts,
                                    [item.id]: { ...draft, category },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ACTION_CATEGORIES.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Priority</Label>
                              <Select
                                value={draft.priority}
                                onValueChange={(priority) =>
                                  setActionItemDrafts((drafts) => ({
                                    ...drafts,
                                    [item.id]: { ...draft, priority },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Week</Label>
                              <Input
                                type="number"
                                min="1"
                                max="4"
                                value={draft.weekNumber}
                                onChange={(event) =>
                                  setActionItemDrafts((drafts) => ({
                                    ...drafts,
                                    [item.id]: { ...draft, weekNumber: event.target.value },
                                  }))
                                }
                                aria-label="Action item week"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Status</Label>
                              <Select
                                value={draft.status}
                                onValueChange={(status) =>
                                  setActionItemDrafts((drafts) => ({
                                    ...drafts,
                                    [item.id]: { ...draft, status },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                  <SelectItem value="in_progress">In progress</SelectItem>
                                  <SelectItem value="done">Done</SelectItem>
                                  <SelectItem value="deferred">Deferred</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Textarea
                            value={draft.description}
                            onChange={(event) =>
                              setActionItemDrafts((drafts) => ({
                                ...drafts,
                                [item.id]: { ...draft, description: event.target.value },
                              }))
                            }
                            aria-label="Action item description"
                            className="min-h-20"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={item.status} />
                            <Button
                              data-testid="geo-aeo-save-action-item"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateActionItem.mutate({
                                  actionItemId: item.id,
                                  title: draft.title,
                                  description: draft.description,
                                  category: draft.category,
                                  priority: draft.priority,
                                  weekNumber: draft.weekNumber,
                                  status: draft.status,
                                })
                              }
                              disabled={!draft.title || updateActionItem.isPending}
                            >
                              Save
                            </Button>
                            {item.status !== "approved" && (
                              <Button size="sm" variant="outline" onClick={() => approveActionItem.mutate(item.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteActionItem.mutate(item.id)}
                              disabled={deleteActionItem.isPending}
                              aria-label="Remove action item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {isClientUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Monthly Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!visibleMonitoringRuns?.length ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No approved monitoring progress available.
                      </div>
                    ) : (
                      visibleMonitoringRuns.map((run) => (
                        <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                          <div>
                            <div className="font-medium">{run.runMonth}</div>
                            <div className="text-sm text-muted-foreground">
                              Score {run.baselineScore ?? "-"} {"->"} {run.currentScore ?? "-"}
                              {run.scoreDelta !== null && run.scoreDelta !== undefined
                                ? ` (${run.scoreDelta > 0 ? "+" : ""}${run.scoreDelta})`
                                : ""}
                            </div>
                          </div>
                          <StatusBadge status={run.status} />
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reports</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!visibleReports?.length ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No reports generated.
                    </div>
                  ) : (
                    visibleReports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                        <div>
                          <div className="font-medium">{report.type.replace(/_/g, " ")}</div>
                          <div className="text-sm text-muted-foreground">
                            {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : report.format}
                          </div>
                        </div>
                        {!isClientUser && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportReport.mutate({ reportId: report.id, format: report.format })}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
