import {
  useGetMyTenant,
  getGetMyTenantQueryKey,
  useUpdateMyTenant,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Building2, Palette, Users } from "lucide-react";

const PLAN_BADGE: Record<string, string> = {
  solo: "bg-slate-500/10 text-slate-600 border-slate-200",
  agency: "bg-blue-500/10 text-blue-600 border-blue-200",
  enterprise: "bg-purple-500/10 text-purple-600 border-purple-200",
};

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tenant, isLoading } = useGetMyTenant({
    query: { queryKey: getGetMyTenantQueryKey() },
  });

  const updateTenant = useUpdateMyTenant();
  const [name, setName] = useState("");
  const [appName, setAppName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      const wl = tenant.whiteLabelConfig as Record<string, string> | null;
      setAppName(wl?.appName ?? "");
      setPrimaryColor(wl?.primaryColor ?? "");
      setLogoUrl(wl?.logoUrl ?? "");
    }
  }, [tenant]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyTenantQueryKey() });
          toast({ title: "Workspace name updated" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      },
    );
  };

  const handleSaveWhiteLabel = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant.mutate(
      {
        data: {
          whiteLabelConfig: {
            appName: appName || undefined,
            primaryColor: primaryColor || undefined,
            logoUrl: logoUrl || undefined,
          },
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyTenantQueryKey() });
          toast({ title: "White-label config saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your workspace configuration</p>
        </div>

        <Card>
          <form onSubmit={handleSaveProfile}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Workspace Profile
              </CardTitle>
              <CardDescription>Your agency's identity inside RankMap</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="name">Workspace Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <div className="pt-2">
                    <Badge
                      variant="outline"
                      className={`capitalize ${PLAN_BADGE[tenant?.plan ?? "solo"] ?? ""}`}
                    >
                      {tenant?.plan ?? "solo"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>
                  {tenant?.seatsUsed ?? 0} of {tenant?.seatsMax ?? 1} seat
                  {(tenant?.seatsMax ?? 1) !== 1 ? "s" : ""} used
                </span>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={updateTenant.isPending || name === tenant?.name}>
                Save Profile
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <form onSubmit={handleSaveWhiteLabel}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                White-Label Configuration
              </CardTitle>
              <CardDescription>
                Customize the client portal with your brand. Requires Agency plan or higher.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">App Name</Label>
                <Input
                  id="appName"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Acme SEO Portal"
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the client portal header instead of "RankMap"
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://yoursite.com/logo.png"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#2563eb"
                    className="font-mono"
                  />
                  {primaryColor && (
                    <div
                      className="w-10 h-10 rounded border shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={updateTenant.isPending}>
                Save White-Label Config
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
