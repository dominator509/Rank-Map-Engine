import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Map } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function AcceptInvite() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const accept = useMutation({
    mutationFn: () =>
      customFetch("/api/team/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token, fullName, password }),
      }),
    onSuccess: () => {
      toast({ title: "Welcome to RankMap!" });
      navigate("/dashboard");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center text-muted-foreground">
            Invalid or missing invitation token.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <Map className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Accept Invitation</h1>
          <p className="text-muted-foreground text-sm mt-1">Set up your RankMap account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>Fill in your details to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {password && confirm && password !== confirm && (
              <p className="text-xs text-destructive">Passwords don't match</p>
            )}
            <Button
              className="w-full"
              onClick={() => accept.mutate()}
              disabled={!fullName || !password || password !== confirm || password.length < 8 || accept.isPending}
            >
              {accept.isPending ? "Setting up..." : "Join Workspace"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
