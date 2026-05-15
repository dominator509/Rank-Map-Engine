import { useParams, Link } from "wouter";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { KeywordsTab } from "@/components/project/keywords-tab";
import { ClustersTab } from "@/components/project/clusters-tab";
import { TopicMapTab } from "@/components/project/topic-map-tab";
import { RoadmapTab } from "@/components/project/roadmap-tab";
import { BriefsTab } from "@/components/project/briefs-tab";
import { ReportsTab } from "@/components/project/reports-tab";
import { useLocation } from "wouter";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-200",
  paused: "bg-amber-500/10 text-amber-600 border-amber-200",
  archived: "bg-slate-500/10 text-slate-500 border-slate-200",
};

const TABS = [
  { value: "keywords", label: "Keywords" },
  { value: "clusters", label: "Clusters" },
  { value: "topic-map", label: "Topic Map" },
  { value: "roadmap", label: "Roadmap" },
  { value: "briefs", label: "Briefs" },
  { value: "reports", label: "Reports" },
];

export default function ProjectDetail() {
  const { clientId, projectId, tab = "keywords" } = useParams();
  const cId = parseInt(clientId || "0", 10);
  const pId = parseInt(projectId || "0", 10);
  const [, setLocation] = useLocation();

  const { data: project, isLoading } = useGetProject(pId, {
    query: { enabled: !!pId, queryKey: getGetProjectQueryKey(pId) },
  });

  const handleTabChange = (val: string) => {
    setLocation(`/clients/${cId}/projects/${pId}/${val}`);
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-destructive">Project not found.</div>;
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="flex flex-col h-full">
      <div className="shrink-0 px-8 pt-8 pb-0 border-b bg-background">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/clients/${cId}`} aria-label="Back to client">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-0.5">
                <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
                <Badge
                  variant="outline"
                  className={`text-xs capitalize shrink-0 ${STATUS_BADGE[project.status] ?? ""}`}
                >
                  {project.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {project.targetDomain}
                {project.locale && <span className="ml-2 opacity-60">{project.locale}</span>}
              </p>
            </div>
          </div>

          <TabsList className="bg-transparent border-b-0 w-full justify-start rounded-none h-auto p-0 gap-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground px-3 pb-3 pt-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          <TabsContent value="keywords" className="m-0">
            <KeywordsTab projectId={pId} />
          </TabsContent>
          <TabsContent value="clusters" className="m-0">
            <ClustersTab projectId={pId} />
          </TabsContent>
          <TabsContent value="topic-map" className="m-0">
            <TopicMapTab projectId={pId} />
          </TabsContent>
          <TabsContent value="roadmap" className="m-0">
            <RoadmapTab projectId={pId} />
          </TabsContent>
          <TabsContent value="briefs" className="m-0">
            <BriefsTab projectId={pId} />
          </TabsContent>
          <TabsContent value="reports" className="m-0">
            <ReportsTab projectId={pId} />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
