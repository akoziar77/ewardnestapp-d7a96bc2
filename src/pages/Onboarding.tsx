import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Bird, Gift, QrCode, Sparkles, Check, ChevronRight, Bell, MapPin } from "lucide-react";

const STEPS = [
  {
    icon: Bird,
    title: "All your rewards, one nest",
    description:
      "No more juggling cards or forgetting points. We bring every loyalty program into a single view.",
    color: "bg-primary",
  },
  {
    icon: Gift,
    title: "Earn & redeem everywhere",
    description:
      "Scan a QR code at any partner merchant. Points accumulate automatically and you can redeem rewards instantly.",
    color: "bg-secondary",
  },
  {
    icon: Sparkles,
    title: "Smart suggestions",
    description:
      "We'll nudge you when a reward is about to expire or when there's a deal you'd love. No spam, just value.",
    color: "bg-primary",
  },
];

const DEMO_MERCHANTS = [
  { name: "Brew & Bean", category: "Coffee", emoji: "☕" },
  { name: "FreshMart", category: "Grocery", emoji: "🛒" },
  { name: "Glow Studio", category: "Beauty", emoji: "💆" },
  { name: "Pedal Co.", category: "Fitness", emoji: "🚴" },
  { name: "BookNook", category: "Books", emoji: "📚" },
  { name: "Sushi Spot", category: "Dining", emoji: "🍣" },
];

function PermissionsStep({ onDone }: { onDone: () => void }) {
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<"location" | "notif" | null>(null);

  const requestLocation = async () => {
    setLoading("location");
    try {
      await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      setLocationGranted(true);
    } catch {
      setLocationGranted(false);
    } finally {
      setLoading(null);
    }
  };

  const requestNotifications = async () => {
    setLoading("notif");
    try {
      if (!("Notification" in window)) {
        setNotifGranted(false);
        return;
      }
      const perm = await Notification.requestPermission();
      setNotifGranted(perm === "granted");

      // Also register push service worker
      if (perm === "granted" && "serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
      }
    } catch {
      setNotifGranted(false);
    } finally {
      setLoading(null);
    }
  };

  const bothHandled = locationGranted !== null && notifGranted !== null;

  return (
    <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/10">
          <Bell className="h-10 w-10 text-primary-foreground" />
        </div>
        <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug">
          Stay in the loop
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
          Enable location and notifications so we can alert you when you're near a partner brand and your rewards are ready.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Location permission */}
        <button
          onClick={requestLocation}
          disabled={locationGranted !== null || loading === "location"}
          className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.96] ${
            locationGranted === true
              ? "border-primary bg-primary/5"
              : locationGranted === false
              ? "border-destructive/30 bg-destructive/5"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              locationGranted === true ? "bg-primary" : "bg-muted"
            }`}
          >
            {locationGranted === true ? (
              <Check className="h-5 w-5 text-primary-foreground" />
            ) : (
              <MapPin className={`h-5 w-5 ${locationGranted === false ? "text-destructive" : "text-muted-foreground"}`} />
            )}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">
              {loading === "location"
                ? "Requesting…"
                : locationGranted === true
                ? "Location enabled"
                : locationGranted === false
                ? "Location denied"
                : "Enable location"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get alerts when you're near partner brands
            </p>
          </div>
        </button>

        {/* Notification permission */}
        <button
          onClick={requestNotifications}
          disabled={notifGranted !== null || loading === "notif"}
          className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.96] ${
            notifGranted === true
              ? "border-primary bg-primary/5"
              : notifGranted === false
              ? "border-destructive/30 bg-destructive/5"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              notifGranted === true ? "bg-primary" : "bg-muted"
            }`}
          >
            {notifGranted === true ? (
              <Check className="h-5 w-5 text-primary-foreground" />
            ) : (
              <Bell className={`h-5 w-5 ${notifGranted === false ? "text-destructive" : "text-muted-foreground"}`} />
            )}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">
              {loading === "notif"
                ? "Requesting…"
                : notifGranted === true
                ? "Notifications enabled"
                : notifGranted === false
                ? "Notifications denied"
                : "Enable notifications"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Know when rewards expire or deals drop
            </p>
          </div>
        </button>
      </div>

      {bothHandled && (
        <p className="text-xs text-muted-foreground text-center mt-4 animate-in fade-in duration-300">
          {locationGranted && notifGranted
            ? "You're all set for the best experience!"
            : "You can change these anytime in Settings."}
        </p>
      )}
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [selectedMerchants, setSelectedMerchants] = useState<Set<number>>(new Set());
  const [completing, setCompleting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Steps: intro slides (3) + permissions (1) + merchant linking (1)
  const PERMISSIONS_STEP = STEPS.length;
  const MERCHANT_STEP = STEPS.length + 1;
  const totalSteps = MERCHANT_STEP + 1;
  const isLastStep = step === totalSteps - 1;

  const toggleMerchant = (idx: number) => {
    setSelectedMerchants((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const completeOnboarding = async () => {
    if (!user) return;
    setCompleting(true);
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);
    navigate("/", { replace: true });
  };

  const next = () => {
    if (isLastStep) {
      completeOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="flex min-h-screen flex-col px-6 py-12">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === step ? "w-8 bg-primary" : i < step ? "w-2 bg-primary/40" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {step < STEPS.length ? (
          /* Feature intro steps */
          <div className="flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-right-4 duration-500">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-3xl ${STEPS[step].color} shadow-lg shadow-primary/10`}
            >
              {(() => {
                const Icon = STEPS[step].icon;
                return <Icon className="h-10 w-10 text-primary-foreground" />;
              })()}
            </div>
            <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug max-w-xs">
              {STEPS[step].title}
            </h2>
            <p className="max-w-xs text-muted-foreground leading-relaxed">
              {STEPS[step].description}
            </p>
          </div>
        ) : step === PERMISSIONS_STEP ? (
          /* Permissions step */
          <PermissionsStep onDone={next} />
        ) : (
          /* Merchant selection step */
          <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary shadow-lg shadow-secondary/10">
                <QrCode className="h-10 w-10 text-secondary-foreground" />
              </div>
              <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug">
                Link your merchants
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick the places you visit. You can always add more later.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {DEMO_MERCHANTS.map((m, i) => {
                const selected = selectedMerchants.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleMerchant(i)}
                    className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.96] ${
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    {selected && (
                      <div className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <span className="text-3xl">{m.emoji}</span>
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="mt-8 flex flex-col gap-3">
        <Button
          onClick={next}
          className="h-14 w-full text-base font-semibold active:scale-[0.97] transition-transform"
          disabled={completing}
        >
          {completing
            ? "Setting up…"
            : isLastStep
            ? selectedMerchants.size > 0
              ? `Continue with ${selectedMerchants.size} merchant${selectedMerchants.size > 1 ? "s" : ""}`
              : "Skip for now"
            : "Continue"}
          {!completing && <ChevronRight className="ml-1 h-5 w-5" />}
        </Button>

        {step < STEPS.length && (
          <button
            onClick={() => {
              setStep(PERMISSIONS_STEP); // skip intro to permissions
            }}
            className="text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
