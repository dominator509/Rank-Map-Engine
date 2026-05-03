import { useGetMyTenant, getGetMyTenantQueryKey, useUpdateMyTenant } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tenant, isLoading } = useGetMyTenant({
    query: { queryKey: getGetMyTenantQueryKey() }
  });

  const updateTenant = useUpdateMyTenant();
  const [name, setName] = useState("");

  useEffect(() => {
    if (tenant) setName(tenant.name);
  }, [tenant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyTenantQueryKey() });
          toast({ title: "Settings updated" });
        }
      }
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your workspace configuration</p>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Workspace Profile</CardTitle>
                <CardDescription>Update your agency details and branding</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="name">Workspace Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6">
                <Button type="submit" disabled={updateTenant.isPending || name === tenant?.name}>
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
