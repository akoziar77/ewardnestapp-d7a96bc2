import {
  Bird, Gift, QrCode, Sparkles, Bell, MapPin, Star, Heart, Zap, Shield,
  Trophy, Crown, Flame, Target, Rocket, ChevronRight, Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ICON_MAP: Record<string, LucideIcon> = {
  Bird, Gift, Sparkles, Bell, QrCode, Star, Heart, Zap, Shield, MapPin,
  Trophy, Crown, Flame, Target, Rocket,
};

interface OnboardingStep {
  title: string;
  description: string;
  icon_name: string;
  color_class: string;
  step_type: string;
  sort_order: number;
  active: boolean;
}

interface Props {
  steps: OnboardingStep[];
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
}

export default function OnboardingStepPreview({ steps, selectedIndex, onSelectIndex }: Props) {
  const activeSteps = steps.filter((s) => s.active);
  const current = activeSteps[selectedIndex];
  const isLast = selectedIndex === activeSteps.length - 1;

  if (activeSteps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No active steps to preview
      </div>
    );
  }

  if (!current) {
    return null;
  }

  const Icon = ICON_MAP[current.icon_name] ?? Sparkles;

  return (
    <div className="flex flex-col h-full">
      {/* Phone frame */}
      <div className="relative mx-auto w-full max-w-[320px] rounded-[2rem] border-2 border-border bg-background shadow-lg overflow-hidden flex flex-col" style={{ minHeight: 520 }}>
        {/* Notch */}
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-muted" />

        <div className="flex-1 flex flex-col px-5 py-6">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-8">
            {activeSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => onSelectIndex(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === selectedIndex
                    ? "h-2 w-6 bg-primary"
                    : i < selectedIndex
                    ? "h-1.5 w-1.5 bg-primary/40"
                    : "h-1.5 w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {current.step_type === "intro" && (
              <>
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl ${current.color_class} shadow-md`}
                >
                  <Icon className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight leading-snug max-w-[240px]">
                  {current.title}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                  {current.description}
                </p>
              </>
            )}

            {current.step_type === "permissions" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent shadow-md">
                  <Shield className="h-8 w-8 text-accent-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight leading-snug max-w-[240px]">
                  {current.title}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                  {current.description}
                </p>
                <div className="mt-4 w-full space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border p-3 text-left text-xs">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">Enable Location</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border p-3 text-left text-xs">
                    <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">Enable Notifications</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </>
            )}

            {current.step_type === "merchant_select" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary shadow-md">
                  <QrCode className="h-8 w-8 text-secondary-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight leading-snug max-w-[240px]">
                  {current.title}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                  {current.description}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                  {["☕", "🛒", "💆", "🚴"].map((emoji, i) => (
                    <div
                      key={i}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs ${
                        i === 0 ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span className="text-xl">{emoji}</span>
                      <span className="font-medium">Brand {i + 1}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bottom button */}
          <div className="mt-4 space-y-2">
            <Button className="h-11 w-full text-sm font-semibold" disabled>
              {isLast ? "Finish" : "Continue"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            {current.step_type === "intro" && (
              <p className="text-center text-[10px] text-muted-foreground">Skip intro</p>
            )}
          </div>
        </div>

        {/* Home indicator */}
        <div className="mx-auto mb-2 h-1 w-28 rounded-full bg-muted" />
      </div>
    </div>
  );
}
