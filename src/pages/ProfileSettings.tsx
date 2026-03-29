import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Bell,
  Moon,
  Locate,
  LogOut,
  Trash2,
  Crown,
  Shield,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useRoles } from "@/hooks/useRoles";
import { requestNotificationPermission } from "@/hooks/useGeofence";
import { hasFeatureAccess } from "@/lib/featureGates";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, signOut, subscriptionTier } = useAuth();
  const { isAdmin } = useRoles();
  const { subscribe: subscribePush, isSupported: pushSupported } = usePushNotifications();

  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    localStorage.getItem("notifications_enabled") !== "false"
  );
  const [geofenceEnabled, setGeofenceEnabled] = useState(() =>
    localStorage.getItem("geofence_enabled") === "true"
  );

  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="relative flex items-center justify-center max-w-lg mx-auto">
          <button onClick={() => navigate("/profile")} className="absolute left-0 flex items-center gap-0.5 text-sm font-medium text-primary">
            <ChevronLeft className="h-5 w-5" /> Profile
          </button>
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Preferences */}
        <div className="rounded-2xl bg-muted/50 overflow-hidden divide-y divide-border/50">
          <button
            onClick={() => {
              const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
              setTheme(next);
            }}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted-foreground text-white">
                <Moon className="h-4.5 w-4.5" />
              </span>
              <span className="text-[15px] font-medium text-foreground">Theme</span>
            </div>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {themeLabel} <ChevronsUpDown className="h-3.5 w-3.5" />
            </span>
          </button>

          <div className="flex w-full items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted-foreground text-white">
                <Bell className="h-4.5 w-4.5" />
              </span>
              <span className="text-[15px] font-medium text-foreground">Notifications</span>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={async (checked) => {
                if (checked) {
                  try {
                    const granted = await requestNotificationPermission();
                    if (granted) {
                      if (pushSupported) { try { await subscribePush(); } catch {} }
                      setNotificationsEnabled(true);
                      localStorage.setItem("notifications_enabled", "true");
                      toast.success("Notifications enabled");
                    } else {
                      setNotificationsEnabled(false);
                      toast.error("Notification permission was denied");
                    }
                  } catch { toast.error("Could not enable notifications"); }
                } else {
                  setNotificationsEnabled(false);
                  localStorage.setItem("notifications_enabled", "false");
                }
              }}
            />
          </div>

          <div className="flex w-full items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted-foreground text-white">
                <Locate className="h-4.5 w-4.5" />
              </span>
              <span className="text-[15px] font-medium text-foreground">Geofence Alerts</span>
            </div>
            {hasFeatureAccess("geofence_alerts", subscriptionTier) ? (
              <Switch
                checked={geofenceEnabled}
                onCheckedChange={async (checked) => {
                  if (checked) {
                    const granted = await requestNotificationPermission();
                    if (!granted) { toast.error("Enable notifications first"); return; }
                    navigator.geolocation.getCurrentPosition(
                      () => { setGeofenceEnabled(true); localStorage.setItem("geofence_enabled", "true"); toast.success("Geofence alerts enabled"); },
                      () => { toast.error("Location permission is required"); }
                    );
                  } else { setGeofenceEnabled(false); localStorage.setItem("geofence_enabled", "false"); }
                }}
              />
            ) : (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/pricing")}>
                <Crown className="h-3 w-3 mr-1" /> Upgrade
              </Button>
            )}
          </div>

          <button className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted">
            <span className="text-[15px] font-medium text-foreground">Language</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              English <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>

        {/* Subscription & Admin */}
        <div className="rounded-2xl bg-muted/50 overflow-hidden divide-y divide-border/50">
          <button
            onClick={() => navigate("/pricing")}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Crown className="h-4.5 w-4.5" />
            </span>
            <span className="flex-1 text-[15px] font-medium text-foreground">Plans & Pricing ({subscriptionTier})</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <Shield className="h-4.5 w-4.5" />
              </span>
              <span className="flex-1 text-[15px] font-medium text-foreground">Admin Dashboard</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 p-4 text-destructive transition-colors hover:bg-destructive/15 active:scale-[0.98]"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-semibold">Sign out</span>
        </button>

        {/* Delete account */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98]">
              <Trash2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Delete account</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This action is permanent and cannot be undone. All your data, visits, rewards, and connections will be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    const { error } = await supabase.functions.invoke("delete-account");
                    if (error) throw error;
                    await signOut();
                    navigate("/auth", { replace: true });
                    toast.success("Account deleted");
                  } catch { toast.error("Failed to delete account"); }
                }}
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <BottomNav />
    </div>
  );
}
