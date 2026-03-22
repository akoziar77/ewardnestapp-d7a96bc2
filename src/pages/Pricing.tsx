import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TIERS, type TierKey } from "@/lib/subscriptionTiers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Crown, Rocket, Building2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";

const tierIcons: Record<TierKey, React.ReactNode> = {
  free: <Rocket className="h-6 w-6" />,
  pro: <Crown className="h-6 w-6" />,
  business: <Building2 className="h-6 w-6" />,
};

export default function Pricing() {
  const { user, subscriptionTier, isSubscribed, refreshSubscription } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCheckout = async (priceId: string, tierKey: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoadingTier(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    setLoadingTier("manage");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      toast.error("Failed to open subscription management");
    } finally {
      setLoadingTier(null);
    }
  };

  const handleRefresh = async () => {
    await refreshSubscription();
    toast.success("Subscription status refreshed");
  };

  const tierOrder: TierKey[] = ["free", "pro", "business"];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground text-balance max-w-md mx-auto">
            Unlock premium features and get the most out of your loyalty rewards
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {tierOrder.map((key) => {
            const tier = TIERS[key];
            const isCurrent = subscriptionTier === key;
            const isPaid = key !== "free";
            const priceId = "price_id" in tier ? tier.price_id : null;

            return (
              <div
                key={key}
                className={`relative rounded-2xl border p-6 flex flex-col transition-shadow duration-300 ${
                  isCurrent
                    ? "border-primary ring-2 ring-primary/20 shadow-lg"
                    : "border-border hover:shadow-md"
                } ${key === "pro" ? "md:-translate-y-2" : ""}`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Your Plan
                  </Badge>
                )}
                {key === "pro" && !isCurrent && (
                  <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`rounded-xl p-2 ${isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {tierIcons[key]}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{tier.name}</h2>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold tabular-nums">{tier.priceLabel}</span>
                  {isPaid && <span className="text-sm text-muted-foreground">/mo</span>}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  isSubscribed ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2 active:scale-[0.97]"
                      onClick={handleManage}
                      disabled={loadingTier === "manage"}
                    >
                      {loadingTier === "manage" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      Manage Subscription
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  )
                ) : isPaid && priceId ? (
                  <Button
                    className="w-full gap-2 active:scale-[0.97]"
                    onClick={() => handleCheckout(priceId, key)}
                    disabled={!!loadingTier}
                  >
                    {loadingTier === key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Crown className="h-4 w-4" />
                    )}
                    {loadingTier === key ? "Loading…" : `Upgrade to ${tier.name}`}
                  </Button>
                ) : (
                  <Button variant="ghost" className="w-full" disabled>
                    Free forever
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {isSubscribed && (
          <div className="text-center mt-6">
            <Button variant="link" size="sm" onClick={handleRefresh}>
              Refresh subscription status
            </Button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
