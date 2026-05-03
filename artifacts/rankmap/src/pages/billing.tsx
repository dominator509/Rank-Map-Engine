import { useGetSubscription, getGetSubscriptionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Check } from "lucide-react";

export default function Billing() {
  const { data: sub, isLoading } = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey() }
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-primary/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Current Plan: {sub?.plan || "Free"}
                </CardTitle>
                <CardDescription>
                  Status: <span className="capitalize text-foreground font-medium">{sub?.status || "Active"}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Seats Used</span>
                    <span className="font-medium">{sub?.seatsUsed || 0} / {sub?.seatsMax || 1}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.min(100, ((sub?.seatsUsed || 0) / (sub?.seatsMax || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  Manage Subscription
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-primary text-primary-foreground border-0">
              <CardHeader>
                <CardTitle>Upgrade to Agency</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Unlock white-label reporting and unlimited seats.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">$99<span className="text-sm font-normal text-primary-foreground/80">/mo</span></div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Unlimited Clients</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4" /> White-label Reports</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Priority AI Queue</li>
                </ul>
                <Button variant="secondary" className="w-full mt-4">
                  Upgrade Now
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
