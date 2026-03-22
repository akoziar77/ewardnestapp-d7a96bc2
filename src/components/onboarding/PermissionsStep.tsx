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

  const bothHandled = locationGranted !== null && notifGranted !== null;

  return (
    <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/10">
          <Bell className="h-10 w-10 text-primary-foreground" />
        </div>
        <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={requestLocation}
          disabled={locationGranted !== null || loading === "location"}
          className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.96] ${
            locationGranted === true ? "border-primary bg-primary/5"
              : locationGranted === false ? "border-destructive/30 bg-destructive/5"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${locationGranted === true ? "bg-primary" : "bg-muted"}`}>
            {locationGranted === true
              ? <Check className="h-5 w-5 text-primary-foreground" />
              : <MapPin className={`h-5 w-5 ${locationGranted === false ? "text-destructive" : "text-muted-foreground"}`} />}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">
              {loading === "location" ? "Requesting…" : locationGranted === true ? "Location enabled" : locationGranted === false ? "Location denied" : "Enable location"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Get alerts when you're near partner brands</p>
          </div>
        </button>

        <button
          onClick={requestNotifications}
          disabled={notifGranted !== null || loading === "notif"}
          className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.96] ${
            notifGranted === true ? "border-primary bg-primary/5"
              : notifGranted === false ? "border-destructive/30 bg-destructive/5"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${notifGranted === true ? "bg-primary" : "bg-muted"}`}>
            {notifGranted === true
              ? <Check className="h-5 w-5 text-primary-foreground" />
              : <Bell className={`h-5 w-5 ${notifGranted === false ? "text-destructive" : "text-muted-foreground"}`} />}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">
              {loading === "notif" ? "Requesting…" : notifGranted === true ? "Notifications enabled" : notifGranted === false ? "Notifications denied" : "Enable notifications"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Know when rewards expire or deals drop</p>
          </div>
        </button>
      </div>

      {bothHandled && (
        <p className="text-xs text-muted-foreground text-center mt-4 animate-in fade-in duration-300">
          {locationGranted && notifGranted ? "You're all set for the best experience!" : "You can change these anytime in Settings."}
        </p>
      )}
    </div>
  );
}
