import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Bird,
  Store,
  Gift,
  QrCode,
  ArrowRight,
  Check,
  Copy,
  ChevronLeft,
} from "lucide-react";

const CATEGORIES = [
  "Coffee & Tea",
  "Restaurant",
  "Bakery",
  "Bar & Nightlife",
  "Retail",
  "Fitness & Wellness",
  "Beauty & Salon",
  "Services",
  "Other",
];

type StepId = "store" | "reward" | "qr";

const STEPS: { id: StepId; label: string; icon: typeof Store }[] = [
  { id: "store", label: "Your store", icon: Store },
  { id: "reward", label: "First reward", icon: Gift },
  { id: "qr", label: "QR code", icon: QrCode },
];

export default function MerchantOnboarding() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [checking, setChecking] = useState(true);

  // Store step
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // Reward step
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardDesc, setRewardDesc] = useState("");
  const [rewardCost, setRewardCost] = useState("100");
  const [creatingReward, setCreatingReward] = useState(false);
  const [rewardCreated, setRewardCreated] = useState(false);

  // QR step
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/merchant/login", { replace: true });
      return;
    }
    supabase
      .from("merchant_users")
      .select("merchant_id, merchants(name, category)")
      .eq("user_id", user.id)
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          navigate("/merchant/login", { replace: true });
          return;
        }
        setMerchantId(data.merchant_id);
        const m = (data as any).merchants;
        setMerchantName(m?.name ?? "");
        if (m?.category) setCategory(m.category);
        setChecking(false);
      });
  }, [user, authLoading, navigate]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const qrValue = `rewardsnest://checkin/${merchantId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}&margin=16`;

  const handleSaveStore = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("merchants")
        .update({ category: category || null })
        .eq("id", merchantId);
      if (error) throw error;
      setStep(1);
    } catch (err: any) {
      toast({
        title: "Error saving",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReward = async () => {
    if (!merchantId || !rewardTitle.trim()) return;
    setCreatingReward(true);
    try {
      const { error } = await supabase.from("rewards").insert({
        merchant_id: merchantId,
        title: rewardTitle.trim(),
        description: rewardDesc.trim() || null,
        points_cost: parseInt(rewardCost, 10) || 100,
        active: true,
      });
      if (error) throw error;
      setRewardCreated(true);
      toast({ title: "Reward created!" });
      setTimeout(() => setStep(2), 600);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCreatingReward(false);
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Bird className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold tracking-tight">{merchantName}</span>
      </header>

      {/* Progress */}
      <div className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-px flex-1 transition-colors ${
                    i < step ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center px-6 py-8">
        <div className="w-full max-w-md space-y-8">
          {/* STEP 0: Store details */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Set up your store
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us a bit about your business
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Business name</Label>
                  <Input
                    value={merchantName}
                    disabled
                    className="h-12 bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleSaveStore}
                disabled={saving}
                className="h-12 w-full text-base font-semibold active:scale-[0.97]"
              >
                {saving ? "Saving…" : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* STEP 1: First reward */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Create your first reward
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Give customers something to earn toward
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rewardTitle">Reward name</Label>
                  <Input
                    id="rewardTitle"
                    placeholder="e.g. Free Coffee"
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rewardDesc">Description (optional)</Label>
                  <Textarea
                    id="rewardDesc"
                    placeholder="Any size, any flavor"
                    value={rewardDesc}
                    onChange={(e) => setRewardDesc(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rewardCost">Points required</Label>
                  <Input
                    id="rewardCost"
                    type="number"
                    min={1}
                    value={rewardCost}
                    onChange={(e) => setRewardCost(e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(0)}
                  className="h-12 px-4 active:scale-[0.97]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleCreateReward}
                  disabled={!rewardTitle.trim() || creatingReward || rewardCreated}
                  className="h-12 flex-1 text-base font-semibold active:scale-[0.97]"
                >
                  {rewardCreated ? (
                    <>
                      <Check className="mr-2 h-4 w-4" /> Created!
                    </>
                  ) : creatingReward ? (
                    "Creating…"
                  ) : (
                    <>
                      Create reward
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* STEP 2: QR code */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Your check-in QR code
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Print this and place it at your counter
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 text-center space-y-5">
                <div className="mx-auto w-[220px] h-[220px] rounded-2xl overflow-hidden border border-border bg-white p-2">
                  <img
                    src={qrImageUrl}
                    alt={`QR code for ${merchantName}`}
                    className="h-full w-full object-contain"
                    loading="eager"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{merchantName}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Scan to earn 50 points
                  </p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <code className="text-xs break-all text-muted-foreground">
                    {qrValue}
                  </code>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(qrValue);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex-1 h-11 active:scale-[0.97]"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" /> Copy link
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => window.open(qrImageUrl, "_blank")}
                    variant="outline"
                    className="flex-1 h-11 active:scale-[0.97]"
                  >
                    <QrCode className="mr-2 h-4 w-4" /> Download
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => navigate("/merchant", { replace: true })}
                className="h-12 w-full text-base font-semibold active:scale-[0.97]"
              >
                Go to dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
