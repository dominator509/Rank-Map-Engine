import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield, Clock, Mail, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface TeamMember {
  id: number;
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Invitation {
  id: number;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  agency_admin: "Admin",
  agency_user: "Member",
  client: "Client",
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  agency_admin: "default",
  agency_user: "secondary",
  client: "outline",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Team() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agency_user");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: () => customFetch("/api/team"),
  });

  const { data: invitations } = useQuery<Invitation[]>({
    queryKey: ["team-invitations"],
    queryFn: () => customFetch("/api/team/invitations"),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      customFetch(`/api/team/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Role updated" });
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: number) => customFetch(`/api/team/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const sendInvite = useMutation({
    mutationFn: () =>
      customFetch("/api/team/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      }),
    onSuccess: (data: { inviteUrl: string; token: string }) => {
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
      setInviteLink(data.inviteUrl || `/accept-invite?token=${data.token}`);
      setInviteEmail("");
      toast({ title: "Invitation sent" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const cancelInvite = useMutation({
    mutationFn: (id: number) => customFetch(`/api/team/invitations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
      toast({ title: "Invitation cancelled" });
    },
  });

  const pending = invitations?.filter((i) => new Date(i.expiresAt) > new Date()) ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team</h1>
            <p className="text-muted-foreground mt-1">Manage team members and invitations</p>
          </div>
          <Dialog
            open={isInviteOpen}
            onOpenChange={(o) => {
              setIsInviteOpen(o);
              if (!o) {
                setInviteLink(null);
                setInviteEmail("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" /> Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a team member</DialogTitle>
              </DialogHeader>
              {inviteLink ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Invitation created. Share this link:
                  </p>
                  <div className="bg-muted rounded-md p-3 text-xs font-mono break-all">
                    {inviteLink}
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      toast({ title: "Copied!" });
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Copy Link
                  </Button>
                  <Button
                    onClick={() => {
                      setIsInviteOpen(false);
                      setInviteLink(null);
                    }}
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Email address</Label>
                    <Input
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agency_admin">Admin</SelectItem>
                        <SelectItem value="agency_user">Member</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => sendInvite.mutate()}
                      disabled={!inviteEmail || sendInvite.isPending}
                      className="w-full"
                    >
                      {sendInvite.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Members ({members?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              : members?.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{initials(m.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{m.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <Badge variant={ROLE_COLORS[m.role] ?? "secondary"}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                    {m.lastLoginAt && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(m.lastLoginAt).toLocaleDateString()}
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          aria-label={`Actions for ${m.fullName}`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => updateRole.mutate({ userId: m.id, role: "agency_admin" })}
                        >
                          <Shield className="w-4 h-4 mr-2" /> Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateRole.mutate({ userId: m.id, role: "agency_user" })}
                        >
                          Make Member
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Remove ${m.fullName}?`)) removeMember.mutate(m.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
          </CardContent>
        </Card>

        {pending.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations ({pending.length})</CardTitle>
              <CardDescription>Invitations expire after 7 days</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {pending.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{inv.email}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">{ROLE_LABELS[inv.role] ?? inv.role}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-8 w-8 p-0"
                    onClick={() => cancelInvite.mutate(inv.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
