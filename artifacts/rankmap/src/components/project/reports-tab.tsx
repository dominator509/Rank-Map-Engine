import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReports,
  getListReportsQueryKey,
  useGenerateReport,
  useDeleteReport,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, BarChart3, FileDown } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  project_summary: "Project Summary",
  topical_authority: "Topical Authority",
  content_pipeline: "Content Pipeline",
};

const FORMAT_STYLES: Record<string, string> = {
  pdf: "bg-red-500/10 text-red-600 border-red-200",
  csv: "bg-green-500/10 text-green-600 border-green-200",
  json: "bg-blue-500/10 text-blue-600 border-blue-200",
};

interface Props {
  projectId: number;
}

export function ReportsTab({ projectId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [reportType, setReportType] = useState<
    "project_summary" | "topical_authority" | "content_pipeline"
  >("project_summary");
  const [reportFormat, setReportFormat] = useState<"pdf" | "csv" | "json">("pdf");

  const { data: reports, isLoading } = useListReports(projectId, {
    query: { enabled: !!projectId, queryKey: getListReportsQueryKey(projectId) },
  });

  const generateReport = useGenerateReport();
  const deleteReport = useDeleteReport();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListReportsQueryKey(projectId) });

  const handleGenerate = () => {
    generateReport.mutate(
      { projectId, data: { type: reportType, format: reportFormat } },
      {
        onSuccess: () => {
          invalidate();
          setIsGenerateOpen(false);
          toast({ title: "Report generated" });
        },
        onError: () => toast({ title: "Failed to generate report", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this report?")) return;
    deleteReport.mutate(
      { projectId, id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Report deleted" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {reports?.length ?? 0} report{reports?.length !== 1 ? "s" : ""} generated
          </p>
        </div>
        <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" /> Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select
                  value={reportType}
                  onValueChange={(v) => setReportType(v as typeof reportType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project_summary">Project Summary</SelectItem>
                    <SelectItem value="topical_authority">Topical Authority</SelectItem>
                    <SelectItem value="content_pipeline">Content Pipeline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={reportFormat}
                  onValueChange={(v) => setReportFormat(v as typeof reportFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleGenerate} disabled={generateReport.isPending}>
                {generateReport.isPending ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !reports?.length ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-lg">No reports yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a project summary, topical authority report, or content pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{TYPE_LABELS[report.type] ?? report.type}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs uppercase ${FORMAT_STYLES[report.format] ?? ""}`}
                  >
                    {report.format}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {report.generatedAt
                    ? new Date(report.generatedAt).toLocaleString()
                    : new Date(report.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {report.fileUrl && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
                      <FileDown className="w-4 h-4 mr-1" /> Download
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(report.id)}
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
