import { useParams, Link } from "wouter";
import {
  useGetClient,
  getGetClientQueryKey,
  useListProjects,
  getListProjectsQueryKey,
  useCreateProject,
  useDeleteProject,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Folder, ArrowLeft, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

export default function ClientDetail() {
  const { clientId } = useParams();
  const id = parseInt(clientId || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: client, isLoading: isLoadingClient } = useGetClient(id, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) },
  });

  const { data: projects, isLoading: isLoadingProjects } = useListProjects(
    {
      clientId: id,
    },
    {
      query: { enabled: !!id, queryKey: getListProjectsQueryKey({ clientId: id }) },
    },
  );

  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createProject.mutate(
      {
        data: {
          clientId: id,
          name: formData.get("name") as string,
          targetDomain: formData.get("targetDomain") as string,
          locale: formData.get("locale") as string,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ clientId: id }) });
          setIsCreateOpen(false);
          toast({ title: "Project created" });
        },
      },
    );
  };

  const handleDelete = (projectId: number) => {
    if (!confirm("Delete project?")) return;
    deleteProject.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ clientId: id }) });
          toast({ title: "Project deleted" });
        },
      },
    );
  };

  if (isLoadingClient) {
    return (
      <div className="p-8">
        <Skeleton className="h-12 w-64 mb-8" />
      </div>
    );
  }

  if (!client) {
    return <div className="p-8 text-destructive">Client not found</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-muted-foreground">
              {client.domain} • {client.industry}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-semibold">Projects</h2>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input id="name" name="name" required placeholder="Q1 SEO Campaign" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDomain">Target Domain</Label>
                    <Input
                      id="targetDomain"
                      name="targetDomain"
                      required
                      defaultValue={client.domain || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locale">Locale</Label>
                    <Select name="locale" defaultValue="en-US">
                      <SelectTrigger>
                        <SelectValue placeholder="Select locale" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-GB">English (UK)</SelectItem>
                        <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProject.isPending}>
                    Save Project
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoadingProjects ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : projects?.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <Folder className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No projects</h3>
            <p className="text-muted-foreground">
              Create a project to start tracking keywords and content.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project) => (
              <Card key={project.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/clients/${client.id}/projects/${project.id}`}
                      className="hover:underline"
                    >
                      {project.name}
                    </Link>
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(project.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end mt-4">
                    <div className="text-sm text-muted-foreground">
                      {project.targetDomain} • {project.locale}
                    </div>
                    <div className="text-xs uppercase font-semibold tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                      {project.status}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
