import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Download, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GDPRSettings() {
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const exportData = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/gdpr/export`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "my-data-export.json"; a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: "Export downloaded" }),
    onError: () => toast({ title: "Export failed", variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: () => customFetch("/api/gdpr/me", { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Account deletion requested" });
      setDeleteOpen(false);
      window.location.href = "/login";
    },
    onError: (e: Error) => toast({ title: e.message || "Failed to delete account", variant: "destructive" }),
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Shield className="w-7 h-7" />Privacy & Data</h1>
          <p className="text-muted-foreground mt-1">Manage your personal data and privacy settings</p>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            RankMap is committed to protecting your privacy. This page lets you exercise your rights under GDPR and similar data protection regulations.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Download Your Data</CardTitle>
            <CardDescription>
              Export all personal data we hold about you — your profile, comments, notifications, and activity log — as a JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => exportData.mutate()} disabled={exportData.isPending} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {exportData.isPending ? "Preparing export..." : "Export My Data"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" />Delete Your Account</CardTitle>
            <CardDescription>
              Permanently anonymise your personal data. Your comments and activity history will be retained in anonymised form as required by audit compliance. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Agency Admins must transfer workspace ownership before deleting their account. Contact your workspace owner or support.
              </AlertDescription>
            </Alert>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" />Delete My Account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This will anonymise your personal data across the platform. Your account access will be immediately revoked. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending}>
                    {deleteAccount.isPending ? "Deleting..." : "Yes, delete my account"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Data Retention Policy</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>Active account data</strong> — retained while your account is active.</p>
            <p>• <strong>Audit logs</strong> — retained for 1 year for compliance purposes.</p>
            <p>• <strong>Deleted account data</strong> — anonymised immediately; purged after 90 days.</p>
            <p>• <strong>Backup retention</strong> — encrypted backups are purged within 30 days of account deletion.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
