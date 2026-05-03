import { useParams, Link, useLocation } from "wouter";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ProjectDetail() {
  const { clientId, projectId, tab = "keywords" } = useParams();
  const cId = parseInt(clientId || "0", 10);
  const pId = parseInt(projectId || "0", 10);
  const [, setLocation] = useLocation();

  const { data: project, isLoading } = useGetProject(pId, {
    query: { enabled: !!pId, queryKey: getGetProjectQueryKey(pId) }
  });

  const handleTabChange = (val: string) => {
    setLocation(`/clients/${cId}/projects/${pId}/${val}`);
  };

  if (isLoading) {
    return <div className="p-8"><Skeleton className="h-12 w-1/3 mb-8" /></div>;
  }

  if (!project) return <div className="p-8 text-destructive">Project not found</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-8 pb-0 border-b">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/clients/${cId}`}><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-muted-foreground">{project.targetDomain}</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 space-x-6">
              <TabsTrigger 
                value="keywords" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 pt-2"
              >
                Keywords
              </TabsTrigger>
              <TabsTrigger 
                value="clusters"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 pt-2"
              >
                Clusters
              </TabsTrigger>
              <TabsTrigger 
                value="topic-map"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 pt-2"
              >
                Topic Map
              </TabsTrigger>
              <TabsTrigger 
                value="roadmap"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 pt-2"
              >
                Roadmap
              </TabsTrigger>
              <TabsTrigger 
                value="briefs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 pt-2"
              >
                Briefs
              </TabsTrigger>
              <TabsTrigger 
                value="reports"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 pt-2"
              >
                Reports
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {tab === "keywords" && <div className="text-muted-foreground">Keyword management goes here</div>}
          {tab === "clusters" && <div className="text-muted-foreground">Cluster management goes here</div>}
          {tab === "topic-map" && <div className="text-muted-foreground">Topic map goes here</div>}
          {tab === "roadmap" && <div className="text-muted-foreground">Roadmap goes here</div>}
          {tab === "briefs" && <div className="text-muted-foreground">Content briefs go here</div>}
          {tab === "reports" && <div className="text-muted-foreground">Reports go here</div>}
        </div>
      </div>
    </div>
  );
}
