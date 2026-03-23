import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Star,
  RefreshCw,
  FileText,
  ShoppingCart,
  Activity,
  Search,
  Link2,
  Calculator,
  SlidersHorizontal,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Clock; label: string; className: string }
> = {
  pending: {
    icon: Clock,
    label: "Pending",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  approved: {
    icon: CheckCircle2,
    label: "Approved",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

type ReceiptSummary = {
  id: string;
  merchant_name: string | null;
  normalized_merchant: string | null;
  total_amount: number | null;
  status: string;
  confidence: number | null;
  admin_review_flag: boolean;
  brand_id: string | null;
  created_at: string;
  retry_count: number;
};

type ReceiptDetail = ReceiptSummary & {
  user_id: string;
  file_path: string | null;
  ocr_text: string | null;
  purchase_date: string | null;
};

type LineItem = {
  id: string;
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  sku: string | null;
  category: string | null;
};

type LogEntry = {
  id: string;
  step: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

async function invokeReceiptAdmin(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("receipt-admin", {
    body: { action, ...body },
  });
  if (error) throw error;
  return data;
}

export default function AdminReceiptReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // ── Receipt list ──
  const { data: receipts, isLoading: listLoading } = useQuery({
    queryKey: ["admin-receipts", statusFilter, flaggedOnly],
    queryFn: async () => {
      const res = await invokeReceiptAdmin("list_receipts", {
        status: statusFilter,
        flagged_only: flaggedOnly,
        limit: 200,
      });
      return (res.receipts ?? []) as ReceiptSummary[];
    },
  });

  // ── Receipt detail ──
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-receipt-detail", selectedId],
    queryFn: async () => {
      const res = await invokeReceiptAdmin("view_receipt", {
        receipt_id: selectedId,
      });
      return {
        receipt: res.receipt as ReceiptDetail,
        items: (res.items ?? []) as LineItem[],
        logs: (res.logs ?? []) as LogEntry[],
      };
    },
    enabled: !!selectedId,
  });

  // ── Action mutations ──
  function useAdminAction(actionName: string) {
    return useMutation({
      mutationFn: async (body: Record<string, unknown>) => {
        return invokeReceiptAdmin(actionName, body);
      },
      onSuccess: (data) => {
        const msg =
          actionName === "approve_receipt"
            ? `Approved — ${data.points_awarded ?? 0} points awarded`
            : actionName === "reject_receipt"
            ? "Receipt rejected"
            : actionName === "rematch_brand"
            ? `Brand rematched: ${data.brand_id ?? "none"}`
            : actionName === "recalc_points"
            ? `Recalculated: ${data.total_points ?? 0} points`
            : actionName === "adjust_points"
            ? `Adjusted: ${data.points_adjusted ?? 0} points`
            : "Done";
        toast.success(msg);
        queryClient.invalidateQueries({ queryKey: ["admin-receipts"] });
        queryClient.invalidateQueries({
          queryKey: ["admin-receipt-detail", selectedId],
        });
      },
      onError: (err: Error) => toast.error(err.message),
    });
  }

  const approveMut = useAdminAction("approve_receipt");
  const rejectMut = useAdminAction("reject_receipt");
  const rematchMut = useAdminAction("rematch_brand");
  const recalcMut = useAdminAction("recalc_points");
  const adjustMut = useAdminAction("adjust_points");

  const anyPending =
    approveMut.isPending ||
    rejectMut.isPending ||
    rematchMut.isPending ||
    recalcMut.isPending ||
    adjustMut.isPending;

  const receipt = detail?.receipt;
  const items = detail?.items ?? [];
  const logs = detail?.logs ?? [];

  const pendingCount =
    receipts?.filter((r) => r.status === "pending").length ?? 0;
  const flaggedCount =
    receipts?.filter((r) => r.admin_review_flag).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="active:scale-95">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <Receipt className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            Receipt Review
          </h1>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Left panel — receipt list */}
        <div className="w-full border-r border-border sm:w-[340px]">
          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5">
            {[null, "pending", "approved", "rejected"].map((s) => (
              <Button
                key={s ?? "all"}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter(s)}
              >
                {s ?? "All"}
              </Button>
            ))}
            <Button
              variant={flaggedOnly ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={() => setFlaggedOnly(!flaggedOnly)}
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              Flagged {flaggedCount > 0 && `(${flaggedCount})`}
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-57px-44px)]">
            {listLoading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !receipts || receipts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Receipt className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No receipts match filters
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 p-1.5">
                {receipts.map((r) => {
                  const cfg =
                    STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const active = selectedId === r.id;

                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${
                        active
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-foreground">
                            {r.merchant_name || "Unknown"}
                          </p>
                          {r.admin_review_flag && (
                            <Star className="h-3 w-3 shrink-0 text-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.total_amount
                            ? `$${Number(r.total_amount).toFixed(2)}`
                            : "—"}{" "}
                          · {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-[10px] ${cfg.className}`}
                      >
                        <StatusIcon className="mr-0.5 h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel — detail */}
        <div className="hidden flex-1 sm:block">
          {!selectedId ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-40" />
              <p className="text-sm">Select a receipt to review</p>
            </div>
          ) : detailLoading ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : receipt ? (
            <ScrollArea className="h-full">
              <div className="max-w-2xl space-y-5 p-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {receipt.merchant_name || "Unknown Merchant"}
                    </h2>
                    {receipt.normalized_merchant &&
                      receipt.normalized_merchant !==
                        receipt.merchant_name && (
                        <p className="text-xs text-muted-foreground">
                          Normalized: {receipt.normalized_merchant}
                        </p>
                      )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      STATUS_CONFIG[receipt.status]?.className ?? ""
                    }
                  >
                    {receipt.status}
                  </Badge>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetaCard
                    label="Total"
                    value={
                      receipt.total_amount
                        ? `$${Number(receipt.total_amount).toFixed(2)}`
                        : "—"
                    }
                  />
                  <MetaCard
                    label="Date"
                    value={
                      receipt.purchase_date
                        ? new Date(
                            receipt.purchase_date
                          ).toLocaleDateString()
                        : "—"
                    }
                  />
                  <MetaCard
                    label="Confidence"
                    value={
                      receipt.confidence !== null
                        ? `${Math.round(
                            Number(receipt.confidence) * 100
                          )}%`
                        : "—"
                    }
                    warn={
                      receipt.confidence !== null &&
                      Number(receipt.confidence) < 0.6
                    }
                  />
                  <MetaCard
                    label="Retries"
                    value={String(receipt.retry_count ?? 0)}
                  />
                </div>

                {/* Actions */}
                <Card className="p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <SlidersHorizontal className="h-4 w-4" />
                    Actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={
                        anyPending || receipt.status === "approved"
                      }
                      onClick={() =>
                        approveMut.mutate({
                          receipt_id: receipt.id,
                        })
                      }
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={
                        anyPending || receipt.status === "rejected"
                      }
                      onClick={() =>
                        rejectMut.mutate({
                          receipt_id: receipt.id,
                        })
                      }
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={anyPending}
                      onClick={() =>
                        rematchMut.mutate({
                          receipt_id: receipt.id,
                        })
                      }
                    >
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      Rematch Brand
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={anyPending}
                      onClick={() =>
                        recalcMut.mutate({
                          receipt_id: receipt.id,
                        })
                      }
                    >
                      <Calculator className="mr-1 h-3.5 w-3.5" />
                      Recalculate
                    </Button>
                  </div>
                </Card>

                {/* OCR text */}
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4" />
                    OCR Text
                  </h3>
                  <ScrollArea className="max-h-48">
                    <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs text-foreground">
                      {receipt.ocr_text || "No OCR text available"}
                    </pre>
                  </ScrollArea>
                </Card>

                {/* Line items */}
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ShoppingCart className="h-4 w-4" />
                    Line Items ({items.length})
                  </h3>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No line items detected
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_60px_70px_80px_80px] gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Price</span>
                        <span>Category</span>
                        <span>SKU</span>
                      </div>
                      <Separator />
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_60px_70px_80px_80px] gap-2 py-1.5 text-xs"
                        >
                          <span className="truncate text-foreground">
                            {item.item_name || "—"}
                          </span>
                          <span className="text-muted-foreground">
                            {item.quantity ?? "—"}
                          </span>
                          <span className="text-foreground">
                            {item.price
                              ? `$${Number(item.price).toFixed(2)}`
                              : "—"}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {item.category || "—"}
                          </span>
                          <span className="truncate font-mono text-muted-foreground">
                            {item.sku || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Activity log */}
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Activity className="h-4 w-4" />
                    Activity Log ({logs.length})
                  </h3>
                  {logs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No activity recorded
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-lg bg-muted/30 px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {log.step}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(
                                log.created_at
                              ).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-foreground">
                            {log.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </ScrollArea>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Card className="px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          warn ? "text-amber-600 dark:text-amber-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
