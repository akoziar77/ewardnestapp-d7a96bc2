import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  DollarSign,
  Receipt,
  ShoppingBasket,
  Star,
  TrendingUp,
  Package,
  Users,
  Zap,
  RefreshCw,
} from "lucide-react";

type Ctx = { merchantId: string; merchantName: string };

async function fetchInsight(action: string, brandId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("brand-receipt-insights", {
    body: { action, brand_id: brandId, ...extra },
  });
  if (error) throw error;
  return data;
}

export default function MerchantInsights() {
  const { merchantId } = useOutletContext<Ctx>();
  const [days, setDays] = useState(30);

  // We need the brand_id linked to this merchant. For now, pass merchantId as brand_id
  // (the edge function accepts it and the merchant_users lookup will authorize).
  // If your data model maps merchant → brand differently, adjust here.
  const brandId = merchantId;

  const summaryQ = useQuery({
    queryKey: ["insights-summary", brandId],
    queryFn: () => fetchInsight("summary", brandId),
  });

  const skuQ = useQuery({
    queryKey: ["insights-sku", brandId],
    queryFn: () => fetchInsight("sku_insights", brandId),
  });

  const customersQ = useQuery({
    queryKey: ["insights-customers", brandId],
    queryFn: () => fetchInsight("top_customers", brandId),
  });

  const timeseriesQ = useQuery({
    queryKey: ["insights-timeseries", brandId, days],
    queryFn: () => fetchInsight("timeseries", brandId, { days }),
  });

  const boostersQ = useQuery({
    queryKey: ["insights-boosters", brandId],
    queryFn: () => fetchInsight("booster_performance", brandId),
  });

  const loading =
    summaryQ.isLoading ||
    skuQ.isLoading ||
    customersQ.isLoading ||
    timeseriesQ.isLoading ||
    boostersQ.isLoading;

  const summary = summaryQ.data;
  const skuItems = skuQ.data?.items ?? [];
  const customers = customersQ.data?.customers ?? [];
  const timeseries = timeseriesQ.data?.timeseries ?? [];
  const boosters = boostersQ.data?.boosters ?? [];

  function refetchAll() {
    summaryQ.refetch();
    skuQ.refetch();
    customersQ.refetch();
    timeseriesQ.refetch();
    boostersQ.refetch();
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Receipt Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Analytics powered by receipt data
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetchAll}
          disabled={loading}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary metrics */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            icon={DollarSign}
            label="Total Spend"
            value={`$${Number(summary.total_spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <MetricCard
            icon={Receipt}
            label="Receipts"
            value={String(summary.receipt_count)}
            sub={`${summary.approved_count} approved`}
          />
          <MetricCard
            icon={ShoppingBasket}
            label="Avg Basket"
            value={`$${Number(summary.avg_basket).toFixed(2)}`}
          />
          <MetricCard
            icon={Star}
            label="Points Awarded"
            value={Number(summary.total_points_awarded).toLocaleString()}
          />
        </div>
      ) : null}

      {/* Time-series chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Spend Over Time
            </CardTitle>
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <Button
                  key={d}
                  variant={days === d ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDays(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {timeseriesQ.isLoading ? (
            <Skeleton className="h-52 w-full rounded-lg" />
          ) : timeseries.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v}`}
                  className="text-muted-foreground"
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Spend"]}
                  labelFormatter={(l: string) =>
                    new Date(l).toLocaleDateString()
                  }
                />
                <Line
                  type="monotone"
                  dataKey="spend"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-column: SKU + Customers */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* SKU insights */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {skuQ.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : skuItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No product data yet
              </p>
            ) : (
              <ScrollArea className="max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skuItems.slice(0, 20).map((item: any) => (
                      <TableRow key={item.name}>
                        <TableCell className="text-sm font-medium">
                          {item.name}
                          {item.category && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {item.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {item.quantity_sold}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          ${Number(item.revenue).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Top customers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customersQ.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : customers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No customer data yet
              </p>
            ) : (
              <ScrollArea className="max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs text-right">Receipts</TableHead>
                      <TableHead className="text-xs text-right">Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.slice(0, 20).map((c: any, i: number) => (
                      <TableRow key={c.user_id}>
                        <TableCell className="text-sm">
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.user_id.slice(0, 8)}…
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {c.receipt_count}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium">
                          ${Number(c.total_spend).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booster performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Booster Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {boostersQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : boosters.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No boosters configured
            </p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={boosters}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar
                    dataKey="total_bonus_awarded"
                    name="Bonus Points"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Booster</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Activations</TableHead>
                    <TableHead className="text-xs text-right">Users</TableHead>
                    <TableHead className="text-xs text-right">Bonus Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boosters.map((b: any) => (
                    <TableRow key={b.booster_id}>
                      <TableCell className="text-sm font-medium">
                        {b.name}
                        {!b.active && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {b.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {b.activations}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {b.unique_users}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {Number(b.total_bonus_awarded).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      )}
    </Card>
  );
}
