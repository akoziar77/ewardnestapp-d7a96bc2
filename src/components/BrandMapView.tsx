import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
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

/** Fly map to user's location once obtained */
function LocateUser() {
  const map = useMap();
  const located = useRef(false);

  useEffect(() => {
    if (located.current) return;
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!located.current) {
          located.current = true;
          map.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 1 });
        }
      },
      () => {
        // Permission denied – stay at default view
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [map]);

  return null;
}

export default function BrandMapView({ brands, onBrandClick }: BrandMapViewProps) {
  const brandsWithLocation = brands.filter(
    (b) => b.latitude != null && b.longitude != null
  );

  // Default center: US center, or first brand with location
  const defaultCenter: [number, number] =
    brandsWithLocation.length > 0
      ? [brandsWithLocation[0].latitude, brandsWithLocation[0].longitude]
      : [39.8283, -98.5795];

  const defaultZoom = brandsWithLocation.length > 0 ? 12 : 4;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-card" style={{ height: 420 }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom
        className="h-full w-full z-0"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocateUser />

        {brandsWithLocation.map((brand) => (
          <React.Fragment key={brand.id}>
            {/* Geofence radius circle */}
            <Circle
              center={[brand.latitude, brand.longitude]}
              radius={brand.geofence_radius_meters}
              pathOptions={{
                color: "hsl(var(--primary))",
                fillColor: "hsl(var(--primary))",
                fillOpacity: 0.1,
                weight: 1.5,
                dashArray: "6 4",
              }}
            />

            {/* Brand marker */}
            <Marker
              position={[brand.latitude, brand.longitude]}
              icon={createEmojiIcon(brand.logo_emoji)}
              eventHandlers={{
                click: () => onBrandClick?.(brand.id),
              }}
            >
              <Popup>
                <div className="text-center min-w-[120px]">
                  <p className="text-lg mb-0.5">{brand.logo_emoji}</p>
                  <p className="font-semibold text-sm">{brand.name}</p>
                  {brand.category && (
                    <p className="text-xs text-muted-foreground">{brand.category}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {brand.geofence_radius_meters}m radius
                  </p>
                  <button
                    onClick={() => onBrandClick?.(brand.id)}
                    className="mt-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    View details →
                  </button>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}
      </MapContainer>

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
