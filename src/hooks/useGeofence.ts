import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getGeofenceRadiusMeters } from "@/pages/BrandSettings";

interface BrandLocationPoint {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_emoji: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  geofence_id?: string;
  triggers?: string[];
  dwell_seconds?: number | null;
  active_hours?: { day_of_week: string; start_time: string; end_time: string }[] | null;
  priority?: number;
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

function getNotifiedKey(locationId: string): string {
  return `geofence_notified_${locationId}`;
}

function wasRecentlyNotified(locationId: string): boolean {
  const raw = localStorage.getItem(getNotifiedKey(locationId));
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < COOLDOWN_MS;
}

function markNotified(locationId: string) {
  localStorage.setItem(getNotifiedKey(locationId), Date.now().toString());
}

async function sendNotification(point: BrandLocationPoint) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const title = `${point.brand_emoji} ${point.brand_name} nearby!`;
  const body = `You're near ${point.brand_name}. Open the app to earn rewards!`;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        tag: `geofence-${point.id}`,
        data: { url: `/brands?brand=${point.brand_id}` },
      } as any);
      return;
    }
  } catch {
    // Fall through
  }

  new Notification(title, {
    body,
    icon: "/pwa-192.png",
    tag: `geofence-${point.id}`,
  });
}

export function useGeofence() {
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const insideFencesRef = useRef<Set<string>>(new Set());

  const { data: locationPoints } = useQuery({
    queryKey: ["geofence-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_locations")
        .select("id, brand_id, name, latitude, longitude, geofence_radius_meters, brands!brand_locations_brand_id_fkey(name, logo_emoji), geofences(geofence_id, triggers, dwell_seconds, active_hours, priority, status)")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data ?? []).map((loc: any) => {
        const activeGeofence = loc.geofences?.find((g: any) => g.status === "ACTIVE") || loc.geofences?.[0];
        return {
          id: loc.id,
          brand_id: loc.brand_id,
          brand_name: loc.brands?.name ?? loc.name,
          brand_emoji: loc.brands?.logo_emoji ?? "🏪",
          latitude: loc.latitude as number,
          longitude: loc.longitude as number,
          geofence_radius_meters: loc.geofence_radius_meters,
          geofence_id: activeGeofence?.geofence_id,
          triggers: activeGeofence?.triggers ?? ["ENTER"],
          dwell_seconds: activeGeofence?.dwell_seconds,
          active_hours: activeGeofence?.active_hours,
          priority: activeGeofence?.priority ?? 1,
        };
      }) as BrandLocationPoint[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const checkProximity = useCallback(
    (position: GeolocationPosition) => {
      if (!locationPoints?.length) return;

      const { latitude, longitude } = position.coords;
      const now = new Date();
      const dayMap: Record<number, string> = { 0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT" };
      const currentDay = dayMap[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      for (const point of locationPoints) {
        // Check active_hours if defined
        if (point.active_hours && Array.isArray(point.active_hours) && point.active_hours.length > 0) {
          const activeNow = point.active_hours.some(
            (ah) => ah.day_of_week === currentDay && currentTime >= ah.start_time && currentTime <= ah.end_time
          );
          if (!activeNow) continue;
        }

        const distance = haversineDistance(
          latitude, longitude,
          point.latitude, point.longitude
        );

        const userRadius = getGeofenceRadiusMeters();
        const effectiveRadius = Math.min(point.geofence_radius_meters, userRadius);
        const isInside = distance <= effectiveRadius;
        const wasInside = insideFencesRef.current.has(point.id);
        const triggers = point.triggers ?? ["ENTER"];

        if (isInside && !wasInside) {
          insideFencesRef.current.add(point.id);

          if (triggers.includes("ENTER") && !wasRecentlyNotified(point.id)) {
            markNotified(point.id);
            sendNotification(point);
            toast(`${point.brand_emoji} You're near ${point.brand_name}!`, {
              description: "Open the app to earn rewards.",
              duration: 6000,
            });
          }
        } else if (!isInside && wasInside) {
          insideFencesRef.current.delete(point.id);

          if (triggers.includes("EXIT") && !wasRecentlyNotified(point.id)) {
            markNotified(point.id);
            toast(`${point.brand_emoji} Leaving ${point.brand_name}`, {
              description: "See you next time!",
              duration: 4000,
            });
          }
        }
      }
    },
    [locationPoints]
  );

  useEffect(() => {
    if (!user || !locationPoints?.length) return;
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
  }, [user, locationPoints, checkProximity]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}
