import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Receipt,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Star,
  RefreshCw,
  ImagePlus,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; className: string }> = {
  pending: { icon: Clock, label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { icon: CheckCircle2, label: "Approved", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { icon: XCircle, label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function ReceiptUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // ── Load receipt history ──
  const { data: receipts, isLoading } = useQuery({
    queryKey: ["my-receipts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_uploads")
        .select("id, merchant_name, total_amount, status, confidence, created_at, admin_review_flag, brand_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // ── Upload mutation ──
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Not logged in");

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receipt-upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: form,
        }
      );

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 429) throw new Error("Rate limited — please try again in a moment");
        if (res.status === 402) throw new Error("Service temporarily unavailable");
        throw new Error(json.error || "Upload failed");
      }

      return json;
    },
    onSuccess: (data) => {
      const msg = data.admin_review_flag
        ? "Receipt uploaded — under review"
        : `Receipt processed! +${data.points_awarded} points`;
      toast.success(msg);
      setSelectedFile(null);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["my-receipts"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── File selection ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  function handleUpload() {
    if (!selectedFile) return;
    uploadMutation.mutate(selectedFile);
  }

  const pendingCount = receipts?.filter((r) => r.status === "pending").length ?? 0;
  const approvedCount = receipts?.filter((r) => r.status === "approved").length ?? 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="active:scale-95">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <Receipt className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Receipts</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-4 pt-5">
        {/* Upload area */}
        <Card className="overflow-hidden">
          <div className="p-5">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Upload a Receipt
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Snap a photo of your receipt to earn points automatically
            </p>

            {/* Preview / picker */}
            {preview ? (
              <div className="relative mb-4 overflow-hidden rounded-xl border border-border">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="max-h-56 w-full object-contain bg-muted/30"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 backdrop-blur-sm active:scale-95"
                >
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary active:scale-[0.98]"
              >
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm font-medium">
                  Tap to select a receipt
                </span>
                <span className="text-xs">
                  Supports images and PDFs
                </span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Action buttons */}
            <div className="flex gap-2">
              {!selectedFile && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Camera
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={!selectedFile || uploadMutation.isPending}
                onClick={handleUpload}
              >
                {uploadMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Receipt
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats strip */}
        {receipts && receipts.length > 0 && (
          <div className="flex gap-3">
            <Card className="flex flex-1 items-center gap-2 px-3 py-2.5">
              <Receipt className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-semibold">{receipts.length}</p>
              </div>
            </Card>
            <Card className="flex flex-1 items-center gap-2 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-sm font-semibold">{approvedCount}</p>
              </div>
            </Card>
            <Card className="flex flex-1 items-center gap-2 px-3 py-2.5">
              <Clock className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-sm font-semibold">{pendingCount}</p>
              </div>
            </Card>
          </div>
        )}

        {/* Receipt history */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Your Receipts
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : !receipts || receipts.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No receipts yet — upload one to start earning
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => {
                const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                const lowConfidence =
                  r.confidence !== null && r.confidence < 0.6;

                return (
                  <Card
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.merchant_name || "Unknown Merchant"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.total_amount
                          ? `$${Number(r.total_amount).toFixed(2)}`
                          : "—"}{" "}
                        · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {lowConfidence && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      {r.admin_review_flag && (
                        <Star className="h-3.5 w-3.5 text-blue-500" />
                      )}
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${cfg.className}`}
                      >
                        <StatusIcon className="mr-0.5 h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
