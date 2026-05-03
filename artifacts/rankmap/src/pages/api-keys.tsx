import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function ApiKeys() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data: keys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: () => customFetch("/api/api-keys"),
  });

  const createKey = useMutation({
    mutationFn: () => customFetch("/api/api-keys", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (data: ApiKey & { key: string }) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKey(data.key);
      setName("");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const revokeKey = useMutation({
    mutationFn: (id: number) => customFetch(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "API key revoked" });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
            <p className="text-muted-foreground mt-1">Programmatic access to RankMap</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) { setNewKey(null); setName(""); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New API Key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
              </DialogHeader>
              {newKey ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                    <p className="text-sm font-medium text-amber-800 mb-2">Copy your API key now — you won't see it again.</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono flex-1 break-all">
                        {showKey ? newKey : `${newKey.slice(0, 14)}${"•".repeat(40)}`}
                      </code>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowKey(!showKey)}>
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { navigator.clipboard.writeText(newKey); toast({ title: "Copied!" }); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Button onClick={() => { setIsCreateOpen(false); setNewKey(null); }} className="w-full">Done</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Key name</Label>
                    <Input placeholder="e.g. CI/CD Pipeline" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <DialogFooter>
                    <Button onClick={() => createKey.mutate()} disabled={!name.trim() || createKey.isPending} className="w-full">
                      {createKey.isPending ? "Creating..." : "Create Key"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Keys</CardTitle>
            <CardDescription>API keys grant full access to your workspace. Keep them secret.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : !keys || keys.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Key className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>No API keys yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {keys.map((k) => (
                  <div key={k.id} className="py-4 flex items-center gap-4">
                    <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{k.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}{"•".repeat(20)}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Created {new Date(k.createdAt).toLocaleDateString()}</p>
                      {k.lastUsedAt && <p>Last used {new Date(k.lastUsedAt).toLocaleDateString()}</p>}
                      {k.expiresAt && <p className="text-amber-600">Expires {new Date(k.expiresAt).toLocaleDateString()}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8 w-8 p-0"
                      onClick={() => { if (confirm("Revoke this API key?")) revokeKey.mutate(k.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Include your API key in requests using the <code className="bg-muted px-1 rounded text-xs">Authorization</code> header:</p>
            <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto">
{`curl https://your-domain.com/api/tenant/dashboard \\
  -H "Authorization: Bearer rm_your_api_key_here"`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
