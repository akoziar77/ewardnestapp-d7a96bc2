import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bird, Gift, QrCode, Sparkles, Check, ChevronRight, Bell, MapPin,
  Star, Heart, Zap, Shield, Trophy, Crown, Flame, Target, Rocket,
  type LucideIcon,
} from "lucide-react";
import PermissionsStep from "@/components/onboarding/PermissionsStep";
import MerchantSelectStep from "@/components/onboarding/MerchantSelectStep";

const ICON_MAP: Record<string, LucideIcon> = {
  Bird, Gift, Sparkles, Bell, QrCode, Star, Heart, Zap, Shield, MapPin,
  Trophy, Crown, Flame, Target, Rocket,
};

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  color_class: string;
  step_type: string;
  sort_order: number;
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["onboarding-steps-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_steps")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as OnboardingStep[];
    },
  });

  const totalSteps = steps.length;
  const current = steps[step];
  const isLastStep = step === totalSteps - 1;

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

  const skipIntro = () => {
    const permIdx = steps.findIndex((s) => s.step_type === "permissions");
    setStep(permIdx >= 0 ? permIdx : step + 1);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-12 w-48 rounded-lg" />
      </div>
    );
  }

  if (!current) return null;

  const Icon = ICON_MAP[current.icon_name] ?? Sparkles;

  return (
    <div className="flex min-h-screen flex-col px-6 py-12">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === step ? "w-8 bg-primary" : i < step ? "w-2 bg-primary/40" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {current.step_type === "intro" && (
          <div className="flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-right-4 duration-500">
            <div className={`flex h-20 w-20 items-center justify-center rounded-3xl ${current.color_class} shadow-lg shadow-primary/10`}>
              <Icon className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug max-w-xs">
              {current.title}
            </h2>
            <p className="max-w-xs text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>
        )}

        {current.step_type === "permissions" && (
          <PermissionsStep
            title={current.title}
            description={current.description}
            onDone={next}
          />
        )}

        {current.step_type === "merchant_select" && (
          <MerchantSelectStep
            title={current.title}
            description={current.description}
          />
        )}
      </div>

      {/* Bottom actions */}
      <div className="mt-8 flex flex-col gap-3">
        <Button
          onClick={next}
          className="h-14 w-full text-base font-semibold active:scale-[0.97] transition-transform"
          disabled={completing}
        >
          {completing ? "Setting up…" : isLastStep ? "Finish" : "Continue"}
          {!completing && <ChevronRight className="ml-1 h-5 w-5" />}
        </Button>

        {current.step_type === "intro" && (
          <button
            onClick={skipIntro}
            className="text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
