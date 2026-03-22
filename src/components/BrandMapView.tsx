import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in bundled environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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
}

interface BrandMapViewProps {
  brands: BrandMapLocation[];
  onBrandClick?: (brandId: string) => void;
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

export default function BrandMapView({ brands, onBrandClick }: BrandMapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const brandsWithLocation = brands.filter(
    (b) => b.latitude != null && b.longitude != null
  );

  const defaultCenter: [number, number] =
    brandsWithLocation.length > 0
      ? [brandsWithLocation[0].latitude, brandsWithLocation[0].longitude]
      : [39.8283, -98.5795];

  const defaultZoom = brandsWithLocation.length > 0 ? 12 : 4;

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org">OSM</a>',
      }).addTo(mapRef.current);

      // Try to fly to user location
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            mapRef.current?.flyTo(
              [pos.coords.latitude, pos.coords.longitude],
              14,
              { duration: 1 }
            );
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }

    const map = mapRef.current;

    // Clear existing layers (except tile layer)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    // Add brand markers and circles
    for (const brand of brandsWithLocation) {
      // Geofence circle
      L.circle([brand.latitude, brand.longitude], {
        radius: brand.geofence_radius_meters,
        color: "hsl(168, 33%, 36%)",
        fillColor: "hsl(168, 33%, 36%)",
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: "6 4",
      }).addTo(map);

      // Brand marker
      const marker = L.marker([brand.latitude, brand.longitude], {
        icon: createEmojiIcon(brand.logo_emoji),
      }).addTo(map);

      marker.bindPopup(`
        <div style="text-align:center;min-width:120px;">
          <p style="font-size:1.125rem;margin-bottom:2px;">${brand.logo_emoji}</p>
          <p style="font-weight:600;font-size:0.875rem;margin:0;">${brand.name}</p>
          ${brand.category ? `<p style="font-size:0.75rem;color:#888;margin:2px 0 0;">${brand.category}</p>` : ""}
          <p style="font-size:10px;color:#888;margin:4px 0 0;">${brand.geofence_radius_meters}m radius</p>
        </div>
      `);

      marker.on("click", () => onBrandClick?.(brand.id));
    }

    // Fit bounds if multiple brands
    if (brandsWithLocation.length > 1) {
      const bounds = L.latLngBounds(
        brandsWithLocation.map((b) => [b.latitude, b.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }

    return () => {};
  }, [brands]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-card" style={{ height: 420 }}>
      <div ref={containerRef} className="h-full w-full z-0" style={{ height: "100%", width: "100%" }} />

      {brandsWithLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="text-center px-6">
            <p className="text-2xl mb-2">📍</p>
            <p className="text-sm font-medium text-foreground">No brand locations yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Brand locations will appear here once they're added
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
