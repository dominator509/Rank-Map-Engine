import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, LayoutTemplate, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Template {
  id: number; name: string; description?: string;
  config: Record<string, unknown>; createdAt: string;
}

export default function Templates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: () => customFetch("/api/templates"),
  });

  const create = useMutation({
    mutationFn: () => customFetch("/api/templates", {
      method: "POST",
      body: JSON.stringify({ name, description: description || undefined }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/templates"] });
      setOpen(false); setName(""); setDescription("");
      toast({ title: "Template created" });
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => customFetch(`/api/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><LayoutTemplate className="w-7 h-7" />Project Templates</h1>
            <p className="text-muted-foreground mt-1">Save and reuse project configurations</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input placeholder="e.g. E-commerce SEO Starter" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Textarea placeholder="What does this template set up?" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <Button className="w-full" onClick={() => create.mutate()} disabled={!name || create.isPending}>
                  Create Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (templates as Template[]).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <LayoutTemplate className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No templates yet</p>
              <p className="text-sm">Save a project configuration as a template for quick reuse.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(templates as Template[]).map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      {t.description && <CardDescription className="mt-1">{t.description}</CardDescription>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Created {format(new Date(t.createdAt), "MMM d, yyyy")}
                  </p>
                  {Object.keys(t.config).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{Object.keys(t.config).join(", ")} configured</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
