import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export interface GeofenceData {
  geofence_id: string;
  location_id: string;
  brand_id: string;
  brand_location_id: string | null;
  type: string;
  radius_m: number;
  triggers: string[];
  dwell_seconds: number | null;
  active_hours: { day_of_week: string; start_time: string; end_time: string }[] | null;
  priority: number;
  status: string;
}

interface BrandMapLocation {
  id: string;
  name: string;
  logo_emoji: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  category: string | null;
  milestone_visits: number;
  milestone_points: number;
  locations?: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number;
    city: string | null;
    state: string | null;
  }[];
}

interface BrandMapViewProps {
  brands: BrandMapLocation[];
  geofences?: GeofenceData[];
  onBrandClick?: (brandId: string) => void;
  showGeofenceLayer?: boolean;
}

function createEmojiIcon(emoji: string) {
  return L.divIcon({
    className: "brand-emoji-marker",
    html: `<div style="font-size:1.75rem;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.18));text-align:center;">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const TRIGGER_COLORS: Record<string, string> = {
  ENTER: "hsl(152, 56%, 40%)",
  EXIT: "hsl(0, 65%, 52%)",
  DWELL: "hsl(38, 85%, 50%)",
};

const STATUS_STYLES: Record<string, { opacity: number; dash: string }> = {
  ACTIVE: { opacity: 0.15, dash: "" },
  INACTIVE: { opacity: 0.06, dash: "4 8" },
  REVIEW: { opacity: 0.1, dash: "2 6" },
  PENDING: { opacity: 0.08, dash: "6 4" },
};

function getGeofenceColor(triggers: string[]): string {
  if (triggers.includes("DWELL")) return TRIGGER_COLORS.DWELL;
  if (triggers.includes("EXIT")) return TRIGGER_COLORS.EXIT;
  return TRIGGER_COLORS.ENTER;
}

function triggerBadges(triggers: string[]): string {
  return triggers
    .map((t) => {
      const color = TRIGGER_COLORS[t] || "#888";
      return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:${color};margin-right:3px;">${t}</span>`;
    })
    .join("");
}

function formatActiveHours(hours: GeofenceData["active_hours"]): string {
  if (!hours || hours.length === 0) return "Always active";
  const grouped: Record<string, string[]> = {};
  for (const h of hours) {
    const key = `${h.start_time}–${h.end_time}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h.day_of_week);
  }
  return Object.entries(grouped)
    .map(([time, days]) => `${days.join(", ")} ${time}`)
    .join("<br/>");
}

export default function BrandMapView({ brands, geofences = [], onBrandClick, showGeofenceLayer = true }: BrandMapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedGeofence, setSelectedGeofence] = useState<GeofenceData | null>(null);

  // Build geofence lookup by brand_location_id
  const gfByLocId = new Map<string, GeofenceData>();
  for (const gf of geofences) {
    if (gf.brand_location_id) gfByLocId.set(gf.brand_location_id, gf);
  }

  // Collect all plottable points
  const allPoints: {
    brandId: string;
    emoji: string;
    brandName: string;
    category: string | null;
    lat: number;
    lng: number;
    radius: number;
    locName: string;
    locId?: string;
    geofence?: GeofenceData;
  }[] = [];

  for (const brand of brands) {
    if (brand.locations && brand.locations.length > 0) {
      for (const loc of brand.locations) {
        if (loc.latitude != null && loc.longitude != null) {
          allPoints.push({
            brandId: brand.id,
            emoji: brand.logo_emoji,
            brandName: brand.name,
            category: brand.category,
            lat: loc.latitude,
            lng: loc.longitude,
            radius: loc.geofence_radius_meters,
            locName: loc.name,
            locId: loc.id,
            geofence: gfByLocId.get(loc.id),
          });
        }
      }
    } else if (brand.latitude != null && brand.longitude != null) {
      allPoints.push({
        brandId: brand.id,
        emoji: brand.logo_emoji,
        brandName: brand.name,
        category: brand.category,
        lat: brand.latitude,
        lng: brand.longitude,
        radius: brand.geofence_radius_meters,
        locName: brand.name,
      });
    }
  }

  const defaultCenter: [number, number] =
    allPoints.length > 0 ? [allPoints[0].lat, allPoints[0].lng] : [39.8283, -98.5795];
  const defaultZoom = allPoints.length > 0 ? 12 : 4;

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org">OSM</a>',
      }).addTo(mapRef.current);

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 1 });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }

    const map = mapRef.current;

    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    for (const pt of allPoints) {
      const gf = pt.geofence;
      const circleColor = gf && showGeofenceLayer ? getGeofenceColor(gf.triggers) : "hsl(168, 33%, 36%)";
      const style = gf ? STATUS_STYLES[gf.status] || STATUS_STYLES.ACTIVE : STATUS_STYLES.ACTIVE;

      L.circle([pt.lat, pt.lng], {
        radius: gf ? gf.radius_m : pt.radius,
        color: circleColor,
        fillColor: circleColor,
        fillOpacity: style.opacity,
        weight: gf && showGeofenceLayer ? 2 : 1.5,
        dashArray: style.dash || "6 4",
      }).addTo(map);

      const marker = L.marker([pt.lat, pt.lng], {
        icon: createEmojiIcon(pt.emoji),
      }).addTo(map);

      let popupHtml = `
        <div style="text-align:center;min-width:150px;max-width:220px;">
          <p style="font-size:1.125rem;margin-bottom:2px;">${pt.emoji}</p>
          <p style="font-weight:600;font-size:0.875rem;margin:0;">${pt.locName}</p>
          ${pt.category ? `<p style="font-size:0.75rem;color:#888;margin:2px 0 0;">${pt.category}</p>` : ""}
      `;

      if (gf && showGeofenceLayer) {
        popupHtml += `
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid #eee;">
            <div style="margin-bottom:4px;">${triggerBadges(gf.triggers)}</div>
            <p style="font-size:10px;color:#666;margin:2px 0;">
              ${gf.type === "CIRCLE" ? `${gf.radius_m}m radius` : gf.type}
              ${gf.dwell_seconds ? ` · ${gf.dwell_seconds}s dwell` : ""}
            </p>
            <p style="font-size:10px;color:#666;margin:2px 0;">
              Priority: ${gf.priority} · ${gf.status}
            </p>
            <p style="font-size:9px;color:#999;margin:2px 0;">
              ${formatActiveHours(gf.active_hours)}
            </p>
          </div>
        `;
      } else {
        popupHtml += `<p style="font-size:10px;color:#888;margin:4px 0 0;">${pt.radius}m radius</p>`;
      }

      popupHtml += `</div>`;
      marker.bindPopup(popupHtml);
      marker.on("click", () => onBrandClick?.(pt.brandId));
    }

    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }

    return () => {};
  }, [brands, geofences, showGeofenceLayer]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Count geofence stats
  const activeGfCount = geofences.filter((g) => g.status === "ACTIVE").length;
  const totalGfCount = geofences.length;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-card" style={{ height: 420 }}>
      <div ref={containerRef} className="h-full w-full z-0" style={{ height: "100%", width: "100%" }} />

      {/* Geofence legend overlay */}
      {showGeofenceLayer && totalGfCount > 0 && (
        <div className="absolute top-3 right-3 z-[1000] bg-card/90 backdrop-blur-sm rounded-xl border border-border p-2.5 shadow-md">
          <p className="text-[10px] font-semibold text-foreground mb-1.5 tracking-wide uppercase">Geofences</p>
          <div className="space-y-1">
            {Object.entries(TRIGGER_COLORS).map(([trigger, color]) => {
              const count = geofences.filter((g) => g.triggers.includes(trigger) && g.status === "ACTIVE").length;
              if (count === 0) return null;
              return (
                <div key={trigger} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-muted-foreground">{trigger}</span>
                  <span className="text-[10px] font-medium text-foreground ml-auto">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              {activeGfCount} active / {totalGfCount} total
            </p>
          </div>
        </div>
      )}

      {allPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="text-center px-6">
            <p className="text-2xl mb-2">📍</p>
            <p className="text-sm font-medium text-foreground">No brand locations yet</p>
            <p className="text-xs text-muted-foreground mt-1">Brand locations will appear here once they're added</p>
          </div>
        </div>
      )}
    </div>
  );
}
