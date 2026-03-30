import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminLedger() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["admin-ledger", typeFilter, merchantFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("ledger_entries")
        .select("*, merchants(name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59Z");

      const { data, error } = await q;
      if (error) throw error;

      if (merchantFilter) {
        const lower = merchantFilter.toLowerCase();
        return (data ?? []).filter((e: any) =>
          (e.merchants?.name ?? "").toLowerCase().includes(lower)
        );
      }
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
        <p className="text-sm text-muted-foreground">All point transactions across merchants.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="earn">Earn</SelectItem>
            <SelectItem value="redeem">Redeem</SelectItem>
            <SelectItem value="brand_milestone">Milestone</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by merchant…"
          value={merchantFilter}
          onChange={(e) => setMerchantFilter(e.target.value)}
          className="w-48"
        />
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No entries found.</TableCell>
              </TableRow>
            ) : (
              entries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs tabular-nums whitespace-nowrap">
                    {format(new Date(e.created_at), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.delta_points >= 0 ? "default" : "destructive"} className="text-xs">
                      {e.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{(e as any).merchants?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[120px]">{e.user_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {e.delta_points > 0 ? "+" : ""}{e.delta_points}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{e.balance_after}</TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[140px]">{e.idempotency_key ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
