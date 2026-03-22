import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Navigation, Map as MapIcon, List } from "lucide-react";
import { getGeofenceRadiusMeters } from "@/pages/BrandSettings";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface BrandWithDistance {
  id: string;
  name: string;
  logo_emoji: string;
  category: string | null;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  distance: number;
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

function createEmojiIcon(emoji: string) {
  return L.divIcon({
    className: "brand-emoji-marker",
    html: `<div style="font-size:1.25rem;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.18));text-align:center;">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function MiniMap({
  brands,
  userPos,
  onBrandClick,
}: {
  brands: BrandWithDistance[];
  userPos: { lat: number; lng: number };
  onBrandClick: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [userPos.lat, userPos.lng],
        zoom: 13,
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OSM',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear non-tile layers
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    // User location marker
    L.circleMarker([userPos.lat, userPos.lng], {
      radius: 6,
      color: "hsl(var(--primary))",
      fillColor: "hsl(var(--primary))",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map);

    // Brand markers + geofence circles
    for (const brand of brands) {
      L.circle([brand.latitude, brand.longitude], {
        radius: brand.geofence_radius_meters,
        color: "hsl(168, 33%, 36%)",
        fillColor: "hsl(168, 33%, 36%)",
        fillOpacity: 0.08,
        weight: 1,
        dashArray: "4 3",
      }).addTo(map);

      const marker = L.marker([brand.latitude, brand.longitude], {
        icon: createEmojiIcon(brand.logo_emoji),
      }).addTo(map);

      marker.bindPopup(
        `<div style="text-align:center;min-width:80px;">
          <p style="font-size:1rem;margin-bottom:1px;">${brand.logo_emoji}</p>
          <p style="font-weight:600;font-size:0.75rem;margin:0;">${brand.name}</p>
          <p style="font-size:10px;color:#888;margin:2px 0 0;">${formatDistance(brand.distance)}</p>
        </div>`
      );

      marker.on("click", () => onBrandClick(brand.id));
    }

    // Fit bounds to include user + brands
    const allPoints: [number, number][] = [
      [userPos.lat, userPos.lng],
      ...brands.map((b) => [b.latitude, b.longitude] as [number, number]),
    ];
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20], maxZoom: 14 });
    }

    return () => {};
  }, [brands, userPos]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden z-0"
      style={{ height: 200 }}
    />
  );
}

export default function NearbyBrandsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [showMap, setShowMap] = useState(false);

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
        .slice(0, 10)
    : [];

  const userRadiusM = getGeofenceRadiusMeters();
  const isInRange = (b: BrandWithDistance) => b.distance <= Math.min(b.geofence_radius_meters, userRadiusM);

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

  const displayBrands = showMap ? nearby : nearby.slice(0, 5);

  return (
    <div className="px-6 py-3">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Nearby Brands</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMap(!showMap)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors active:scale-95 ${
                showMap ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
              title={showMap ? "Show list" : "Show map"}
            >
              {showMap ? <List className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => navigate("/brands")}
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </button>
          </div>
        </div>

        {showMap && userPos && (
          <div className="mb-3">
            <MiniMap
              brands={displayBrands}
              userPos={userPos}
              onBrandClick={(id) => navigate(`/brands?brand=${id}`)}
            />
          </div>
        )}

        <div className="space-y-1">
          {displayBrands.map((brand) => {
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
