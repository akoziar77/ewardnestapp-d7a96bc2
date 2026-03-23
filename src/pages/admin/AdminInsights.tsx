import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Receipt,
  Award,
  Users,
  Activity,
  ShoppingCart,
  Zap,
  TrendingUp,
  AlertCircle,
  Clock,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

async function fetchInsight(action: string, extra?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-insights", {
    body: { action, ...extra },
  });
  if (error) throw error;
  return data;
}

export default function AdminInsights() {

  const summaryQ = useQuery({
    queryKey: ["admin-insights", "summary"],
    queryFn: () => fetchInsight("summary"),
  });

  const healthQ = useQuery({
    queryKey: ["admin-insights", "health"],
    queryFn: () => fetchInsight("health"),
  });

  const brandsQ = useQuery({
    queryKey: ["admin-insights", "brands"],
    queryFn: () => fetchInsight("brands"),
  });

  const boostersQ = useQuery({
    queryKey: ["admin-insights", "boosters"],
    queryFn: () => fetchInsight("boosters"),
  });

  const skuQ = useQuery({
    queryKey: ["admin-insights", "top_sku"],
    queryFn: () => fetchInsight("top_sku"),
  });

  const usersQ = useQuery({
    queryKey: ["admin-insights", "top_users"],
    queryFn: () => fetchInsight("top_users"),
  });

  const timeseriesQ = useQuery({
    queryKey: ["admin-insights", "timeseries"],
    queryFn: () => fetchInsight("timeseries"),
  });

  const summary = summaryQ.data;
  const health = healthQ.data;
  const brands = brandsQ.data?.brands ?? [];
  const boosters = boostersQ.data?.boosters ?? [];
  const topSku = skuQ.data?.items ?? [];
  const topUsers = usersQ.data?.users ?? [];
  const timeseries = timeseriesQ.data?.timeseries ?? [];

  const isLoading =
    summaryQ.isLoading ||
    healthQ.isLoading ||
    brandsQ.isLoading ||
    boostersQ.isLoading;

  return (
    <div className="pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ── Summary Metrics ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Total Spend"
            value={summary ? `$${summary.total_spend.toLocaleString()}` : null}
            loading={summaryQ.isLoading}
          />
          <MetricCard
            icon={<Receipt className="h-5 w-5" />}
            label="Receipts"
            value={summary?.receipt_count?.toLocaleString()}
            loading={summaryQ.isLoading}
          />
          <MetricCard
            icon={<Award className="h-5 w-5" />}
            label="Points Awarded"
            value={summary?.total_points?.toLocaleString()}
            loading={summaryQ.isLoading}
          />
          <MetricCard
            icon={<Users className="h-5 w-5" />}
            label="Active Users"
            value={summary?.active_users?.toLocaleString()}
            loading={summaryQ.isLoading}
          />
        </section>

        {/* ── System Health ── */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            System Health
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <HealthCard
              label="OCR Success"
              value={health ? `${health.ocr_success}%` : null}
              loading={healthQ.isLoading}
            />
            <HealthCard
              label="Avg Confidence"
              value={health ? `${health.avg_processing}` : null}
              loading={healthQ.isLoading}
            />
            <HealthCard
              label="Error Rate"
              value={health ? `${health.error_rate}%` : null}
              loading={healthQ.isLoading}
              warn={health && health.error_rate > 10}
            />
            <HealthCard
              label="Queue Depth"
              value={health?.queue_depth?.toString()}
              loading={healthQ.isLoading}
              warn={health && health.queue_depth > 20}
            />
          </div>
        </section>

        {/* ── Timeseries Chart ── */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Platform Spend (30 days)
          </h2>
          <Card>
            <CardContent className="pt-6">
              {timeseriesQ.isLoading ? (
                <Skeleton className="h-[220px] w-full rounded-lg" />
              ) : timeseries.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">
                  No receipt data yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timeseries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Brand Performance ── */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Brand Performance
          </h2>
          <Card>
            <CardContent className="p-0">
              {brandsQ.isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : brands.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No brand data
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Receipts</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.slice(0, 20).map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.receipts}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${b.spend.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.points.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Top SKUs ── */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Top SKUs
          </h2>
          <Card>
            <CardContent className="p-0">
              {skuQ.isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : topSku.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No SKU data
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSku.slice(0, 20).map((i: any) => (
                      <TableRow key={i.name}>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {i.quantity_sold}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${i.revenue.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Top Users ── */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Top Users
          </h2>
          <Card>
            <CardContent className="p-0">
              {usersQ.isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : topUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No user data
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Receipts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topUsers.slice(0, 20).map((u: any) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-mono text-xs">
                          {u.user_id.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${u.spend.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {u.receipts}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Booster Performance ── */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Booster Performance
          </h2>
          <Card>
            <CardContent className="p-0">
              {boostersQ.isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : boosters.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No booster data
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booster</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">
                        Points Awarded
                      </TableHead>
                      <TableHead className="text-right">Activations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boosters.map((b: any) => (
                      <TableRow key={b.booster_id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{b.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.total_points_awarded.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.activations}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-6 w-20 mt-1" />
          ) : (
            <p className="text-lg font-bold tabular-nums text-foreground truncate">
              {value ?? "—"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Health Card ── */
function HealthCard({
  label,
  value,
  loading,
  warn,
}: {
  label: string;
  value: string | null | undefined;
  loading: boolean;
  warn?: boolean;
}) {
  return (
    <Card className={warn ? "border-destructive/50" : ""}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {warn && <AlertCircle className="h-3 w-3 text-destructive" />}
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p
            className={`text-xl font-bold tabular-nums mt-1 ${
              warn ? "text-destructive" : "text-foreground"
            }`}
          >
            {value ?? "—"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
