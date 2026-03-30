import { useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

export default function MerchantAwardPoints() {
  const navigate = useNavigate();
  const { merchantId, merchantName } = useOutletContext<{ merchantId: string; merchantName: string }>();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("customer") ?? "";

  const [points, setPoints] = useState("10");
  const [reason, setReason] = useState("Visit");
  const [submitting, setSubmitting] = useState(false);

  const { data: customer } = useQuery({
    queryKey: ["customer-profile", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, first_name, last_name, nest_points, tier")
        .eq("user_id", customerId)
        .single();
      return data;
    },
    enabled: !!customerId,
  });

  // Get visit count for this customer at this merchant
  const { data: visitCount = 0 } = useQuery({
    queryKey: ["customer-visits", customerId, merchantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ledger_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", customerId)
        .eq("merchant_id", merchantId)
        .eq("type", "earn");
      return count ?? 0;
    },
    enabled: !!customerId && !!merchantId,
  });

  const handleAward = async () => {
    const pts = parseInt(points, 10);
    if (!pts || pts <= 0) { toast.error("Enter a valid point amount"); return; }
    if (!customerId) { toast.error("No customer selected"); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-checkin", {
        body: { merchant_id: merchantId, customer_id: customerId, points: pts, reason },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || "Award failed");

      toast.success(`Awarded ${pts} points to ${customer?.display_name || "customer"}`);
      navigate("/merchant");
    } catch (err: any) {
      toast.error(err.message || "Failed to award points");
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = customer?.display_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customerId.slice(0, 8);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/merchant/scan")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Award Points</h1>
          <p className="text-sm text-muted-foreground">{merchantName}</p>
        </div>
      </div>

      {/* Customer Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-lg font-semibold">{displayName}</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{visitCount} visits</span>
            <span>{customer?.nest_points?.toLocaleString() ?? 0} nest pts</span>
            <span className="capitalize">{customer?.tier ?? "bronze"} tier</span>
          </div>
        </CardContent>
      </Card>

      {/* Award Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="points">Points to award</Label>
          <Input id="points" type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button onClick={handleAward} disabled={submitting} className="w-full h-12 text-base font-semibold">
          <Send className="h-4 w-4 mr-2" />
          {submitting ? "Awarding…" : "Award Points"}
        </Button>
      </div>
    </div>
  );
}
