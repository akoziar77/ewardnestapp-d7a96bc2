import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Navigation } from "lucide-react";

interface BrandWithDistance {
  id: string;
  name: string;
  logo_emoji: string;
  category: string | null;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  distance: number; // meters
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function NearbyBrandsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationDenied(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands-with-location"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, logo_emoji, category, latitude, longitude, geofence_radius_meters")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const nearby: BrandWithDistance[] = userPos
    ? brands
        .map((b: any) => ({
          ...b,
          distance: haversine(userPos.lat, userPos.lng, b.latitude, b.longitude),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
    : [];

  const isInRange = (b: BrandWithDistance) => b.distance <= b.geofence_radius_meters;

  if (locationDenied) {
    return (
      <div className="px-6 py-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Nearby Brands</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Enable location access to see brands near you.
          </p>
        </div>
      </div>
    );
  }

  if (!userPos) {
    return (
      <div className="px-6 py-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Nearby Brands</h2>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (nearby.length === 0) {
    return (
      <div className="px-6 py-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Nearby Brands</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            No brand locations available yet. Check back later!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-3">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Nearby Brands</h2>
          </div>
          <button
            onClick={() => navigate("/brands")}
            className="text-xs font-medium text-primary hover:underline"
          >
            View map
          </button>
        </div>

        <div className="space-y-1">
          {nearby.map((brand) => {
            const inRange = isInRange(brand);
            return (
              <button
                key={brand.id}
                onClick={() => navigate(`/brands?brand=${brand.id}`)}
                className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]"
              >
                <span className="text-xl shrink-0">{brand.logo_emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{brand.name}</p>
                  {brand.category && (
                    <p className="text-[11px] text-muted-foreground">{brand.category}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {inRange && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Navigation className="h-2.5 w-2.5" />
                      Here
                    </span>
                  )}
                  <span className={`text-xs tabular-nums ${inRange ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                    {formatDistance(brand.distance)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
