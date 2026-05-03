import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import { format } from "date-fns";

interface UsageData {
  plan: string;
  period: { start: string; end: string };
  usage: {
    keywords: { used: number; limit: number };
    briefs: { used: number; limit: number };
    aiTasks: { used: number; limit: number };
    seats: { used: number; limit: number };
    reportsThisMonth: number;
    apiKeys: number;
    webhookDeliveriesThisMonth: number;
  };
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const warning = pct >= 80;
  const critical = pct >= 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={critical ? "text-destructive" : warning ? "text-yellow-600" : "text-muted-foreground"}>
          {used.toLocaleString()} / {unlimited ? "Unlimited" : limit.toLocaleString()}
          {!unlimited && ` (${pct}%)`}
        </span>
      </div>
      {!unlimited && (
        <Progress value={pct} className={critical ? "[&>div]:bg-destructive" : warning ? "[&>div]:bg-yellow-500" : ""} />
      )}
    </div>
  );
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  solo: { label: "Solo", color: "bg-gray-500" },
  starter: { label: "Starter", color: "bg-blue-500" },
  agency: { label: "Agency", color: "bg-purple-500" },
  enterprise: { label: "Enterprise", color: "bg-amber-500" },
};

export default function Usage() {
  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ["/api/usage"],
    queryFn: () => customFetch("/api/usage"),
  });

  const plan = PLAN_LABELS[data?.plan ?? "solo"];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Activity className="w-7 h-7" />Usage</h1>
          <p className="text-muted-foreground mt-1">Your workspace resource consumption this billing period</p>
        </div>

        {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>
                      Period: {data?.period.start ? format(new Date(data.period.start), "MMM d") : "—"} –{" "}
                      {data?.period.end ? format(new Date(data.period.end), "MMM d, yyyy") : "—"}
                    </CardDescription>
                  </div>
                  <Badge className={`${plan?.color ?? "bg-gray-500"} text-white`}>{plan?.label ?? data?.plan}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <UsageBar label="Keywords" used={data?.usage.keywords.used ?? 0} limit={data?.usage.keywords.limit ?? 500} />
                <UsageBar label="Content Briefs" used={data?.usage.briefs.used ?? 0} limit={data?.usage.briefs.limit ?? 20} />
                <UsageBar label="AI Tasks (this month)" used={data?.usage.aiTasks.used ?? 0} limit={data?.usage.aiTasks.limit ?? 50} />
                <UsageBar label="Team Seats" used={data?.usage.seats.used ?? 0} limit={data?.usage.seats.limit ?? 1} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Reports This Month</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{data?.usage.reportsThisMonth ?? 0}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active API Keys</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{data?.usage.apiKeys ?? 0}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Webhook Deliveries (30d)</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{data?.usage.webhookDeliveriesThisMonth ?? 0}</div></CardContent></Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
