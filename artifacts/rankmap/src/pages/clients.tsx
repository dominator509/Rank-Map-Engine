import { useState } from "react";
import { Link } from "wouter";
import { 
  useListClients, 
  getListClientsQueryKey,
  useCreateClient,
  useUpdateClient,
  useDeleteClient
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useListClients({
    query: { queryKey: getListClientsQueryKey() }
  });

  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.domain?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createClient.mutate(
      { 
        data: {
          name: formData.get("name") as string,
          domain: formData.get("domain") as string,
          industry: formData.get("industry") as string,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setIsCreateOpen(false);
          toast({ title: "Client created successfully" });
        },
        onError: () => {
          toast({ title: "Failed to create client", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    deleteClient.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({ title: "Client deleted" });
        }
      }
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground mt-1">Manage your agency's clients and their projects</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Client Name</Label>
                    <Input id="name" name="name" required placeholder="Acme Corp" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domain">Primary Domain</Label>
                    <Input id="domain" name="domain" required placeholder="acme.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input id="industry" name="industry" placeholder="Software" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createClient.isPending}>
                    Save Client
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search clients..." 
              className="pl-9" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : filteredClients?.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No clients found</h3>
            <p className="text-muted-foreground">Get started by creating your first client.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients?.map((client) => (
              <Card key={client.id} className="hover:border-primary/50 transition-colors group">
                <CardHeader className="pb-4 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-xl mb-1">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>{client.domain}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/clients/${client.id}`} className="cursor-pointer">
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => handleDelete(client.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Client
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    {client.isActive ? "Active" : "Inactive"}
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
