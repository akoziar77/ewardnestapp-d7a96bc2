import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Navigation, Map as MapIcon, List, ChevronDown } from "lucide-react";
import { getGeofenceRadiusMeters } from "@/pages/BrandSettings";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface NearbyLocation {
  id: string;
  brand_id: string;
  name: string;
  brand_name: string;
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
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

const DISTANCE_OPTIONS = [
  { label: "1 mi", miles: 1 },
  { label: "2 mi", miles: 2 },
  { label: "5 mi", miles: 5 },
  { label: "10 mi", miles: 10 },
  { label: "25 mi", miles: 25 },
  { label: "50 mi", miles: 50 },
  { label: "All", miles: Infinity },
];

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
  locations,
  userPos,
  onBrandClick,
}: {
  locations: NearbyLocation[];
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

    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    L.circleMarker([userPos.lat, userPos.lng], {
      radius: 6,
      color: "hsl(var(--primary))",
      fillColor: "hsl(var(--primary))",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map);

    for (const loc of locations) {
      L.circle([loc.latitude, loc.longitude], {
        radius: loc.geofence_radius_meters,
        color: "hsl(168, 33%, 36%)",
        fillColor: "hsl(168, 33%, 36%)",
        fillOpacity: 0.08,
        weight: 1,
        dashArray: "4 3",
      }).addTo(map);

      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: createEmojiIcon(loc.logo_emoji),
      }).addTo(map);

      marker.bindPopup(
        `<div style="text-align:center;min-width:80px;">
          <p style="font-size:1rem;margin-bottom:1px;">${loc.logo_emoji}</p>
          <p style="font-weight:600;font-size:0.75rem;margin:0;">${loc.name}</p>
          <p style="font-size:10px;color:#888;margin:2px 0 0;">${formatDistance(loc.distance)}</p>
        </div>`
      );

      marker.on("click", () => onBrandClick(loc.brand_id));
    }

    const allPts: [number, number][] = [
      [userPos.lat, userPos.lng],
      ...locations.map((l) => [l.latitude, l.longitude] as [number, number]),
    ];
    if (allPts.length > 1) {
      map.fitBounds(L.latLngBounds(allPts), { padding: [20, 20], maxZoom: 14 });
    }

    return () => {};
  }, [locations, userPos]);

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
  const [maxMiles, setMaxMiles] = useState(5);
  const [distDropdownOpen, setDistDropdownOpen] = useState(false);

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

  const { data: rawLocations = [] } = useQuery({
    queryKey: ["nearby-brand-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_locations")
        .select("id, brand_id, name, latitude, longitude, geofence_radius_meters, city, state, brands!brand_locations_brand_id_fkey(name, logo_emoji, category)")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data ?? []).map((loc: any) => ({
        id: loc.id,
        brand_id: loc.brand_id,
        name: loc.name,
        brand_name: loc.brands?.name ?? loc.name,
        logo_emoji: loc.brands?.logo_emoji ?? "🏪",
        category: loc.brands?.category ?? null,
        latitude: loc.latitude as number,
        longitude: loc.longitude as number,
        geofence_radius_meters: loc.geofence_radius_meters,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate distances, filter by max miles, keep only closest per brand
  const nearby: NearbyLocation[] = userPos
    ? (() => {
        const maxMeters = maxMiles === Infinity ? Infinity : maxMiles * 1609.344;
        const withDist = rawLocations
          .map((loc: any) => ({
            ...loc,
            distance: haversine(userPos.lat, userPos.lng, loc.latitude, loc.longitude),
          }))
          .filter((loc: any) => loc.distance <= maxMeters)
          .sort((a: NearbyLocation, b: NearbyLocation) => a.distance - b.distance);

        // Keep only the closest location per brand
        const seenBrands = new Set<string>();
        const closestPerBrand: NearbyLocation[] = [];
        for (const loc of withDist) {
          if (!seenBrands.has(loc.brand_id)) {
            seenBrands.add(loc.brand_id);
            closestPerBrand.push(loc);
          }
        }
        return closestPerBrand.slice(0, 10);
      })()
    : [];

  const userRadiusM = getGeofenceRadiusMeters();
  const isInRange = (loc: NearbyLocation) => loc.distance <= Math.min(loc.geofence_radius_meters, userRadiusM);

  const selectedLabel = DISTANCE_OPTIONS.find((o) => o.miles === maxMiles)?.label ?? "5 mi";

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

  const displayLocs = showMap ? nearby : nearby.slice(0, 5);

  return (
    <div className="px-6 py-3">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Nearby Brands</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Distance dropdown */}
            <div className="relative">
              <button
                onClick={() => setDistDropdownOpen(!distDropdownOpen)}
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors active:scale-95"
              >
                {selectedLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
              {distDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDistDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[5rem] rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                    {DISTANCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.miles}
                        onClick={() => {
                          setMaxMiles(opt.miles);
                          setDistDropdownOpen(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
                          maxMiles === opt.miles ? "font-semibold text-primary bg-primary/5" : "text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
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
              locations={displayLocs}
              userPos={userPos}
              onBrandClick={(id) => navigate(`/brands?brand=${id}`)}
            />
          </div>
        )}

        {nearby.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No brands within {selectedLabel}. Try increasing the distance.
          </p>
        ) : (
          <div className="space-y-1">
            {displayLocs.map((loc) => {
              const inRange = isInRange(loc);
              return (
                <button
                  key={loc.id}
                  onClick={() => navigate(`/brands?brand=${loc.brand_id}`)}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]"
                >
                  <span className="text-xl shrink-0">{loc.logo_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{loc.brand_name}</p>
                    {loc.category && (
                      <p className="text-[11px] text-muted-foreground">{loc.category}</p>
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
                      {formatDistance(loc.distance)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
