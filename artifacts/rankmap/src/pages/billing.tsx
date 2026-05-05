import {
  useGetSubscription,
  getGetSubscriptionQueryKey,
  useListPlans,
  getListPlansQueryKey,
  useGetBillingUsage,
  getGetBillingUsageQueryKey,
  useCreateCheckoutSession,
  useCreateBillingPortal,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Check, Zap, Users, Folder, ExternalLink } from "lucide-react";

export default function Billing() {
  const { toast } = useToast();

  const { data: sub, isLoading: isLoadingSub } = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey() },
  });

  const { data: plans, isLoading: isLoadingPlans } = useListPlans({
    query: { queryKey: getListPlansQueryKey() },
  });

  const { data: usage, isLoading: isLoadingUsage } = useGetBillingUsage({
    query: { queryKey: getGetBillingUsageQueryKey() },
  });

  const createCheckout = useCreateCheckoutSession();
  const createPortal = useCreateBillingPortal();

  // Only redirect to known Stripe domains — prevents open-redirect attacks
  const safeStripeRedirect = (url: string | undefined) => {
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol === "https:" &&
        (parsed.hostname === "checkout.stripe.com" || parsed.hostname === "billing.stripe.com")
      ) {
        // nosemgrep: javascript.browser.security.js-open-redirect-from-function
        // URL is validated above — only checkout.stripe.com and billing.stripe.com are allowed.
        window.location.href = url;
      } else {
        toast({ title: "Invalid redirect URL", variant: "destructive" });
      }
    } catch {
      toast({ title: "Invalid redirect URL", variant: "destructive" });
    }
  };

  const handleUpgrade = (planId: string) => {
    createCheckout.mutate(
      { data: { planId } },
      {
        onSuccess: (res) => safeStripeRedirect(res.url),
        onError: () =>
          toast({ title: "Stripe is not configured in this environment", variant: "destructive" }),
      },
    );
  };

  const handleManageSubscription = () => {
    createPortal.mutate(undefined, {
      onSuccess: (res) => safeStripeRedirect(res.url),
      onError: () =>
        toast({ title: "Stripe is not configured in this environment", variant: "destructive" }),
    });
  };

  const isLoading = isLoadingSub || isLoadingPlans || isLoadingUsage;

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  const seatPct = sub ? Math.round((sub.seatsUsed / Math.max(sub.seatsMax, 1)) * 100) : 0;
  const aiPct =
    usage && usage.aiTasksLimit > 0
      ? Math.round((usage.aiTasksThisMonth / usage.aiTasksLimit) * 100)
      : 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage your subscription and monitor usage</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="w-4 h-4 text-primary" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold capitalize">{sub?.plan ?? "Solo"}</div>
                  <div className="text-sm text-muted-foreground capitalize mt-0.5">
                    Status:{" "}
                    <span className="text-foreground font-medium">{sub?.status ?? "active"}</span>
                  </div>
                </div>
                {sub?.currentPeriodEnd && (
                  <div className="text-right text-xs text-muted-foreground">
                    <div>Renews</div>
                    <div className="font-medium text-foreground">
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" /> Seats
                    </span>
                    <span className="font-medium">
                      {sub?.seatsUsed ?? 0} / {sub?.seatsMax ?? 1}
                    </span>
                  </div>
                  <Progress value={seatPct} className="h-1.5" />
                </div>
                {usage && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Zap className="w-3.5 h-3.5" /> AI Tasks (this month)
                      </span>
                      <span className="font-medium">
                        {usage.aiTasksThisMonth} /{" "}
                        {usage.aiTasksLimit > 0 ? usage.aiTasksLimit : "∞"}
                      </span>
                    </div>
                    {usage.aiTasksLimit > 0 && <Progress value={aiPct} className="h-1.5" />}
                  </div>
                )}
                {usage && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Folder className="w-3.5 h-3.5" /> Projects
                      </span>
                      <span className="font-medium">
                        {usage.projectsCount} / {usage.projectsMax > 0 ? usage.projectsMax : "∞"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleManageSubscription}
                disabled={createPortal.isPending}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Manage Subscription
              </Button>
            </CardFooter>
          </Card>

          {usage && (
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base">Usage Summary</CardTitle>
                <CardDescription>Current billing period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">AI Tasks Consumed</span>
                    <span className="font-semibold">{usage.aiTasksThisMonth}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Active Projects</span>
                    <span className="font-semibold">{usage.projectsCount}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Team Members</span>
                    <span className="font-semibold">{sub?.seatsUsed ?? 1}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {plans && plans.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = sub?.plan === plan.name;
                return (
                  <Card key={plan.id} className={isCurrent ? "border-primary shadow-sm" : ""}>
                    <CardHeader className="pb-4">
                      {isCurrent && <Badge className="self-start mb-2 text-xs">Current Plan</Badge>}
                      <CardTitle className="capitalize text-lg">{plan.displayName}</CardTitle>
                      <div className="text-3xl font-bold">
                        ${plan.priceMonthly}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>
                          {plan.seats} seat{plan.seats !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>
                          {plan.projectsMax > 0 ? plan.projectsMax : "Unlimited"} project
                          {plan.projectsMax !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>{plan.aiTasksPerMonth} AI tasks/mo</span>
                      </div>
                      {plan.whiteLabelEnabled && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                          <span>White-label client portal</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="border-t pt-4">
                      <Button
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent || createCheckout.isPending}
                        onClick={() => !isCurrent && handleUpgrade(plan.id)}
                      >
                        {isCurrent ? "Current Plan" : `Upgrade to ${plan.displayName}`}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
