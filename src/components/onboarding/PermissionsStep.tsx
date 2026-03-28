import { useState } from "react";
import { Check, MapPin, Bell } from "lucide-react";

interface Props {
  title: string;
  description: string;
  onDone: () => void;
}

export default function PermissionsStep({ title, description }: Props) {
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<"location" | "notif" | null>(null);

  const requestLocation = async () => {
    setLoading("location");
    try {
      await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      setLocationGranted(true);
    } catch {
      setLocationGranted(false);
    } finally {
      setLoading(null);
    }
  };

  const requestNotifications = async () => {
    setLoading("notif");
    try {
      if (!("Notification" in window)) { setNotifGranted(false); return; }
      const perm = await Notification.requestPermission();
      setNotifGranted(perm === "granted");
      if (perm === "granted" && "serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
      }
    } catch {
      setNotifGranted(false);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-[15px] text-white/60 max-w-[300px] mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={requestLocation}
          disabled={locationGranted !== null || loading === "location"}
          className={`flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 active:scale-[0.96] ${
            locationGranted === true
              ? "bg-[hsl(220,90%,56%)]/10 ring-1 ring-[hsl(220,90%,56%)]"
              : locationGranted === false
              ? "bg-white/5 ring-1 ring-red-500/30"
              : "bg-white/[0.06] hover:bg-white/[0.10]"
          }`}
        >
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            locationGranted === true ? "bg-[hsl(220,90%,56%)]" : "bg-white/10"
          }`}>
            {locationGranted === true
              ? <Check className="h-5 w-5 text-white" />
              : <MapPin className={`h-5 w-5 ${locationGranted === false ? "text-red-400" : "text-white/60"}`} />}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-white">
              {loading === "location" ? "Requesting…" : locationGranted === true ? "Location enabled" : locationGranted === false ? "Location denied" : "Enable location"}
            </p>
            <p className="text-xs text-white/40 mt-0.5">Get alerts when you're near partner brands</p>
          </div>
        </button>

        <button
          onClick={requestNotifications}
          disabled={notifGranted !== null || loading === "notif"}
          className={`flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 active:scale-[0.96] ${
            notifGranted === true
              ? "bg-[hsl(220,90%,56%)]/10 ring-1 ring-[hsl(220,90%,56%)]"
              : notifGranted === false
              ? "bg-white/5 ring-1 ring-red-500/30"
              : "bg-white/[0.06] hover:bg-white/[0.10]"
          }`}
        >
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            notifGranted === true ? "bg-[hsl(220,90%,56%)]" : "bg-white/10"
          }`}>
            {notifGranted === true
              ? <Check className="h-5 w-5 text-white" />
              : <Bell className={`h-5 w-5 ${notifGranted === false ? "text-red-400" : "text-white/60"}`} />}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-white">
              {loading === "notif" ? "Requesting…" : notifGranted === true ? "Notifications enabled" : notifGranted === false ? "Notifications denied" : "Enable notifications"}
            </p>
            <p className="text-xs text-white/40 mt-0.5">Know when rewards expire or deals drop</p>
          </div>
        </button>
      </div>
    </div>
  );
}
