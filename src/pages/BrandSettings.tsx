import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radar } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "hidden-brand-categories";
const RADIUS_KEY = "geofence-radius-miles";
const DEFAULT_RADIUS_MILES = 0.5;

export function getHiddenCategories(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getGeofenceRadiusMiles(): number {
  try {
    const val = parseFloat(localStorage.getItem(RADIUS_KEY) || "");
    return isNaN(val) ? DEFAULT_RADIUS_MILES : val;
  } catch {
    return DEFAULT_RADIUS_MILES;
  }
}

export function getGeofenceRadiusMeters(): number {
  return getGeofenceRadiusMiles() * 1609.34;
}

export default function BrandSettings() {
  const navigate = useNavigate();

  const allCategories = [
    "Airlines", "Apparel", "Beauty", "Car Rental", "Coffee",
    "Convenience", "Dining", "Electronics", "Fast Food", "Gas",
    "Grocery", "Home Improvement", "Hotels", "Pharmacy", "Retail", "Wholesale",
  ];

  const [hidden, setHidden] = useState<string[]>(getHiddenCategories);
  const [radiusMiles, setRadiusMiles] = useState(getGeofenceRadiusMiles);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  }, [hidden]);

  useEffect(() => {
    localStorage.setItem(RADIUS_KEY, radiusMiles.toString());
  }, [radiusMiles]);

  const toggle = (cat: string) => {
    setHidden((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Brand Settings</h1>
          <p className="text-sm text-muted-foreground">
            Geofence radius & category filters
          </p>
        </div>
      </header>

      {/* Geofence Radius */}
      <div className="px-6 py-3">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Geofence Radius</Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Set how close you need to be to trigger nearby alerts and check-in eligibility.
          </p>
          <div className="space-y-3">
            <Slider
              value={[radiusMiles]}
              onValueChange={([v]) => setRadiusMiles(Math.round(v * 10) / 10)}
              min={0.1}
              max={5}
              step={0.1}
              className="w-full"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">0.1 mi</span>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {radiusMiles.toFixed(1)} mi
              </span>
              <span className="text-xs text-muted-foreground">5.0 mi</span>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              ≈ {Math.round(radiusMiles * 1609.34).toLocaleString()} meters
            </p>
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="px-6 pt-2 pb-1">
        <h2 className="text-sm font-semibold text-muted-foreground">Categories</h2>
      </div>
      <div className="px-6 py-1 space-y-1">
        {allCategories.map((cat) => {
          const isVisible = !hidden.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 transition-all active:scale-[0.99]"
            >
              <span className="text-sm font-medium">{cat}</span>
              <Switch
                checked={isVisible}
                onCheckedChange={() => toggle(cat)}
                onClick={(e) => e.stopPropagation()}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
