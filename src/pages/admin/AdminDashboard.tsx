import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Receipt, Gift, Store } from "lucide-react";

export default function AdminDashboard() {
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
    { label: "Brands", value: stats?.brands, icon: Store, color: "text-emerald-600" },
    { label: "Receipts", value: stats?.receipts, icon: Receipt, color: "text-amber-600" },
    { label: "Rewards", value: stats?.rewards, icon: Gift, color: "text-violet-600" },
    { label: "Merchants", value: stats?.merchants, icon: Users, color: "text-sky-600" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your loyalty program.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
