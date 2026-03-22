import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getGeofenceRadiusMeters } from "@/pages/BrandSettings";

interface BrandLocation {
  id: string;
  name: string;
  logo_emoji: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
}

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COOLDOWN_MS = 30 * 60 * 1000;

function getNotifiedKey(brandId: string): string {
  return `geofence_notified_${brandId}`;
}

function wasRecentlyNotified(brandId: string): boolean {
  const raw = localStorage.getItem(getNotifiedKey(brandId));
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < COOLDOWN_MS;
}

function markNotified(brandId: string) {
  localStorage.setItem(getNotifiedKey(brandId), Date.now().toString());
}

async function sendNotification(brand: BrandLocation) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const title = `${brand.logo_emoji} ${brand.name} nearby!`;
  const body = `You're near ${brand.name}. Open the app to earn rewards!`;

  // Try service worker notification first (works in background)
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        tag: `geofence-${brand.id}`,
        data: { url: `/brands?brand=${brand.id}` },
      } as any);
      return;
    }
  } catch {
    // Fall through to regular Notification API
  }

  new Notification(title, {
    body,
    icon: "/pwa-192.png",
    tag: `geofence-${brand.id}`,
  });
}

export function useGeofence() {
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const insideFencesRef = useRef<Set<string>>(new Set());

  const { data: brandLocations } = useQuery({
    queryKey: ["brand-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, logo_emoji, latitude, longitude, geofence_radius_meters")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data ?? []) as BrandLocation[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const checkProximity = useCallback(
    (position: GeolocationPosition) => {
      if (!brandLocations?.length) return;

      const { latitude, longitude } = position.coords;

      for (const brand of brandLocations) {
        const distance = haversineDistance(
          latitude, longitude,
          brand.latitude, brand.longitude
        );

        const userRadius = getGeofenceRadiusMeters();
        const effectiveRadius = Math.min(brand.geofence_radius_meters, userRadius);
        const isInside = distance <= effectiveRadius;
        const wasInside = insideFencesRef.current.has(brand.id);

        if (isInside && !wasInside) {
          insideFencesRef.current.add(brand.id);

          if (!wasRecentlyNotified(brand.id)) {
            markNotified(brand.id);
            sendNotification(brand);
            toast(`${brand.logo_emoji} You're near ${brand.name}!`, {
              description: "Open the app to earn rewards.",
              duration: 6000,
            });
          }
        } else if (!isInside && wasInside) {
          insideFencesRef.current.delete(brand.id);
        }
      }
    },
    [brandLocations]
  );

  useEffect(() => {
    if (!user || !brandLocations?.length) return;
    if (!("geolocation" in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      checkProximity,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          console.log("Geofence: location permission denied");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 15000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [user, brandLocations, checkProximity]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}
