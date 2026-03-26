import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Receipt, Gift, Store, TrendingUp, ChevronRight,
  Shield, FileText, Settings, Layout, Zap, Navigation, Lock,
  Megaphone, Workflow, Plug, BarChart3, Webhook, Activity, Dices, Upload,
} from "lucide-react";

const quickLinks = [
  { to: "/merchant", icon: Store, label: "Merchant Dashboard" },
  { to: "/admin/users", icon: Users, label: "Manage Users" },
  { to: "/admin/program-settings", icon: Settings, label: "Program Settings" },
  { to: "/admin/program-settings/page-access", icon: Lock, label: "Page Access Control" },
  { to: "/admin/program-settings/privacy-policy", icon: FileText, label: "Privacy Policies" },
  { to: "/admin/program-settings/quick-actions", icon: Settings, label: "Quick Actions" },
  { to: "/admin/program-settings/onboarding", icon: Navigation, label: "Onboarding Flow" },
  { to: "/admin/program-settings/pages", icon: Layout, label: "Page Directory" },
  { to: "/admin/brands", icon: Store, label: "Brands" },
  { to: "/admin/receipts", icon: Receipt, label: "Receipts" },
  { to: "/admin/rewards", icon: Gift, label: "Rewards" },
  { to: "/admin/campaigns", icon: Megaphone, label: "Campaigns" },
  { to: "/admin/automations", icon: Workflow, label: "Automations" },
  { to: "/admin/automations/webhooks", icon: Webhook, label: "Webhooks" },
  { to: "/admin/automations/events", icon: Activity, label: "Events" },
  { to: "/admin/integrations", icon: Plug, label: "Integrations" },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin/spin-setup", icon: Dices, label: "Spin Setup" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [brands, receipts, rewards, merchants] = await Promise.all([
        supabase.from("brands").select("id", { count: "exact", head: true }),
        supabase.from("receipt_uploads").select("id", { count: "exact", head: true }),
        supabase.from("rewards").select("id", { count: "exact", head: true }),
        supabase.from("merchants").select("id", { count: "exact", head: true }),
      ]);
      return {
        brands: brands.count ?? 0,
        receipts: receipts.count ?? 0,
        rewards: rewards.count ?? 0,
        merchants: merchants.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Total Users", value: stats?.merchants, icon: Users },
    { label: "Partner Brands", value: stats?.brands, icon: Store },
    { label: "Receipts", value: stats?.receipts, icon: Receipt },
    { label: "Rewards Redeemed", value: stats?.rewards, icon: Gift },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          Overview of your loyalty program performance.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-3xl font-bold tabular-nums text-foreground">
                      {value?.toLocaleString() ?? "0"}
                    </p>
                  )}
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rn-gold/10">
                  <Icon className="h-5 w-5 text-rn-gold" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Quick Links
        </p>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {quickLinks.map(({ to, icon: Icon, label }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm font-medium">{label}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
