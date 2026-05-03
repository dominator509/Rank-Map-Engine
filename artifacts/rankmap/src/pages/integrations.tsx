import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plug, CheckCircle2, XCircle, Trash2, Settings } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface Integration {
  id: number;
  provider: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

const PROVIDERS = [
  {
    id: "ahrefs",
    name: "Ahrefs",
    description: "Import keyword data from Ahrefs Keywords Explorer",
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "ahrefs_api_..." }],
    docsUrl: "https://docs.ahrefs.com/reference/introduction",
  },
  {
    id: "semrush",
    name: "SEMrush",
    description: "Import keyword data from SEMrush Keyword Analytics",
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "Your SEMrush API key" }],
    docsUrl: "https://developer.semrush.com/api/",
  },
  {
    id: "dataforseo",
    name: "DataForSEO",
    description: "Import keyword data from DataForSEO Keywords Data API",
    fields: [
      { key: "login", label: "Login", type: "text", placeholder: "your@email.com" },
      { key: "password", label: "Password", type: "password", placeholder: "DataForSEO password" },
    ],
    docsUrl: "https://docs.dataforseo.com/",
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    description: "Import real-world search performance data",
    fields: [{ key: "accessToken", label: "Access Token", type: "password", placeholder: "OAuth access token" }],
    docsUrl: "https://developers.google.com/webmaster-tools",
  },
];

export default function Integrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configuring, setConfiguring] = useState<typeof PROVIDERS[0] | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => customFetch("/api/integrations"),
  });

  const saveIntegration = useMutation({
    mutationFn: () => customFetch("/api/integrations", {
      method: "POST",
      body: JSON.stringify({ provider: configuring?.id, credentials: formValues }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setConfiguring(null);
      setFormValues({});
      toast({ title: "Integration saved" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const removeIntegration = useMutation({
    mutationFn: (provider: string) => customFetch(`/api/integrations/${provider}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["integrations"] }); toast({ title: "Integration removed" }); },
  });

  const connectedIds = new Set(integrations?.map((i) => i.provider) ?? []);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect external data sources to import keyword data</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROVIDERS.map((provider) => {
              const isConnected = connectedIds.has(provider.id);
              return (
                <Card key={provider.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Plug className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-base">{provider.name}</CardTitle>
                      </div>
                      <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                        {isConnected ? (
                          <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</>
                        ) : "Not connected"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{provider.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      variant={isConnected ? "outline" : "default"}
                      size="sm"
                      className="flex-1"
                      onClick={() => { setConfiguring(provider); setFormValues({}); }}
                    >
                      <Settings className="w-3.5 h-3.5 mr-1.5" />
                      {isConnected ? "Reconfigure" : "Configure"}
                    </Button>
                    {isConnected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-8 w-8 p-0"
                        onClick={() => { if (confirm(`Remove ${provider.name} integration?`)) removeIntegration.mutate(provider.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!configuring} onOpenChange={(o) => { if (!o) { setConfiguring(null); setFormValues({}); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure {configuring?.name}</DialogTitle>
            </DialogHeader>
            {configuring && (
              <div className="space-y-4">
                {configuring.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label>{field.label}</Label>
                    <Input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formValues[field.key] ?? ""}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Credentials are stored securely.{" "}
                  <a href={configuring.docsUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    View API docs →
                  </a>
                </p>
                <DialogFooter>
                  <Button
                    onClick={() => saveIntegration.mutate()}
                    disabled={saveIntegration.isPending || Object.values(formValues).some((v) => !v.trim())}
                    className="w-full"
                  >
                    {saveIntegration.isPending ? "Saving..." : "Save Integration"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
