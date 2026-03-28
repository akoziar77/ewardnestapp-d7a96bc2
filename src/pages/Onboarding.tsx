import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bird, Gift, QrCode, Sparkles, Check, Bell, MapPin,
  Star, Heart, Zap, Shield, Trophy, Crown, Flame, Target, Rocket, Cake,
  type LucideIcon,
} from "lucide-react";
import PermissionsStep from "@/components/onboarding/PermissionsStep";
import MerchantSelectStep from "@/components/onboarding/MerchantSelectStep";
import AddressStep from "@/components/onboarding/AddressStep";
import DobStep from "@/components/onboarding/DobStep";

import onboardingRewards from "@/assets/onboarding-rewards.png";
import onboardingScan from "@/assets/onboarding-scan.png";
import onboardingBrands from "@/assets/onboarding-brands.png";
import onboardingNotifications from "@/assets/onboarding-notifications.png";
import onboardingLocation from "@/assets/onboarding-location.png";

const ICON_MAP: Record<string, LucideIcon> = {
  Bird, Gift, Sparkles, Bell, QrCode, Star, Heart, Zap, Shield, MapPin,
  Trophy, Crown, Flame, Target, Rocket, Cake,
};

const STEP_IMAGES: Record<string, string> = {
  Bird: onboardingRewards,
  Gift: onboardingRewards,
  Sparkles: onboardingRewards,
  QrCode: onboardingScan,
  Star: onboardingRewards,
  Heart: onboardingBrands,
  Bell: onboardingNotifications,
  MapPin: onboardingLocation,
  Shield: onboardingRewards,
  Trophy: onboardingRewards,
  Crown: onboardingRewards,
  Flame: onboardingRewards,
  Target: onboardingRewards,
  Rocket: onboardingRewards,
  Cake: onboardingRewards,
  Zap: onboardingRewards,
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
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
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

  const saveBrandSelections = async () => {
    if (!user || selectedBrands.length === 0) return;
    const rows = selectedBrands.map((brand_id) => ({ user_id: user.id, brand_id }));
    await supabase.from("favorite_brands").upsert(rows, { onConflict: "user_id,brand_id" });
  };

  const completeOnboarding = async () => {
    if (!user) return;
    setCompleting(true);
    await saveBrandSelections();
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);
    navigate("/", { replace: true });
  };

  const next = async () => {
    if (current?.step_type === "merchant_select") {
      await saveBrandSelections();
    }
    if (isLastStep) {
      completeOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => completeOnboarding();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Skeleton className="h-12 w-48 rounded-lg bg-white/10" />
      </div>
    );
  }

  if (!current) return null;

  const heroImage = STEP_IMAGES[current.icon_name] || onboardingRewards;

  // Determine if this is a step type that needs its own layout
  const isPermissions = current.step_type === "permissions";
  const isMerchantSelect = current.step_type === "merchant_select";
  const isAddress = current.step_type === "address_input";
  const isDob = current.step_type === "dob_input";
  const isIntro = current.step_type === "intro";
  const isSpecialStep = isPermissions || isMerchantSelect || isAddress || isDob;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-white relative overflow-hidden">
      {/* Skip button */}
      <div className="flex justify-end px-6 pt-4 z-10">
        <button
          onClick={skip}
          className="text-sm font-medium text-white/70 hover:text-white transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {isIntro && (
          <div className="flex flex-1 flex-col items-center animate-in fade-in duration-500">
            {/* Hero illustration - takes up ~45% of screen */}
            <div className="flex flex-1 items-center justify-center px-8 pt-4 pb-2">
              <img
                src={heroImage}
                alt=""
                className="w-64 h-64 object-contain drop-shadow-2xl"
                width={256}
                height={256}
              />
            </div>

            {/* Text content */}
            <div className="px-8 text-center pb-4">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
                {current.title}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-white/60 max-w-[300px] mx-auto">
                {current.description}
              </p>
            </div>
          </div>
        )}

        {isPermissions && (
          <div className="flex flex-1 flex-col items-center animate-in fade-in duration-500">
            <div className="flex items-center justify-center px-8 pt-8 pb-4">
              <img
                src={onboardingNotifications}
                alt=""
                className="w-48 h-48 object-contain drop-shadow-2xl"
                loading="lazy"
                width={192}
                height={192}
              />
            </div>
            <div className="flex-1 w-full px-6">
              <PermissionsStep
                title={current.title}
                description={current.description}
                onDone={next}
              />
            </div>
          </div>
        )}

        {isMerchantSelect && (
          <div className="flex flex-1 flex-col animate-in fade-in duration-500 px-6">
            <MerchantSelectStep
              title={current.title}
              description={current.description}
              onSelectionChange={setSelectedBrands}
            />
          </div>
        )}

        {isAddress && (
          <div className="flex flex-1 flex-col items-center animate-in fade-in duration-500">
            <div className="flex items-center justify-center px-8 pt-8 pb-4">
              <img
                src={onboardingLocation}
                alt=""
                className="w-48 h-48 object-contain drop-shadow-2xl"
                loading="lazy"
                width={192}
                height={192}
              />
            </div>
            <div className="flex-1 w-full px-6">
              <AddressStep title={current.title} description={current.description} />
            </div>
          </div>
        )}

        {isDob && (
          <div className="flex flex-1 flex-col items-center animate-in fade-in duration-500">
            <div className="flex items-center justify-center px-8 pt-8 pb-4">
              <img
                src={onboardingRewards}
                alt=""
                className="w-48 h-48 object-contain drop-shadow-2xl"
                loading="lazy"
                width={192}
                height={192}
              />
            </div>
            <div className="flex-1 w-full px-6">
              <DobStep title={current.title} description={current.description} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom section: Button + Terms + Dots */}
      <div className="px-6 pb-8 pt-4 space-y-4">
        {/* CTA Button */}
        <Button
          onClick={next}
          disabled={completing}
          className="h-14 w-full rounded-2xl bg-[hsl(220,90%,56%)] hover:bg-[hsl(220,90%,50%)] text-white text-base font-semibold active:scale-[0.97] transition-all border-0"
        >
          {completing
            ? "Setting up…"
            : isPermissions
            ? "Allow Push Notification"
            : isLastStep
            ? "Get Started"
            : "Next"}
        </Button>

        {/* Secondary action for permissions */}
        {isPermissions && (
          <button
            onClick={next}
            className="w-full text-center text-sm font-medium text-[hsl(220,90%,56%)] hover:text-[hsl(220,90%,70%)] transition-colors"
          >
            Not Now
          </button>
        )}

        {/* Terms text for intro */}
        {isIntro && (
          <p className="text-center text-xs text-white/40">
            By using RewardsNest you agree to its{" "}
            <span className="text-[hsl(220,90%,56%)]">Terms & Conditions</span>
          </p>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-400 ${
                i === step
                  ? "bg-white"
                  : i < step
                  ? "bg-white/40"
                  : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
