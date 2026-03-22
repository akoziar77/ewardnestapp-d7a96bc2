import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
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
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  LogOut,
  Shield,
  Bell,
  Moon,
  Camera,
  ChevronRight,
  Save,
  MapPin,
  Locate,
  Trash2,
  Crown,
  FileText,
} from "lucide-react";
import { requestNotificationPermission } from "@/hooks/useGeofence";
import { hasFeatureAccess } from "@/lib/featureGates";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import ConsentHistory from "@/components/ConsentHistory";

export default function Profile() {
  const { user, signOut, subscriptionTier } = useAuth();
  const { isAdmin } = useRoles();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    localStorage.getItem("notifications_enabled") !== "false"
  );
  const [geofenceEnabled, setGeofenceEnabled] = useState(() =>
    localStorage.getItem("geofence_enabled") === "true"
  );
  const { theme, setTheme } = useTheme();
  const { subscribe: subscribePush, isSupported: pushSupported } = usePushNotifications();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formZip, setFormZip] = useState("");

  // Sync form when profile loads or edit starts
  const startEditing = () => {
    setFormName(profile?.display_name ?? "");
    setFormPhone(profile?.phone ?? "");
    setFormAddress((profile as any)?.address ?? "");
    setFormCity((profile as any)?.city ?? "");
    setFormState((profile as any)?.state ?? "");
    setFormZip((profile as any)?.zip_code ?? "");
    setEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: formName.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim() || null,
          city: formCity.trim() || null,
          state: formState.trim() || null,
          zip_code: formZip.trim() || null,
        } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setEditing(false);
      toast.success("Profile updated");
    },
    onError: () => toast.error("Failed to save changes"),
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials = (profile?.display_name ?? user?.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
      </header>

      {isLoading ? (
        <div className="space-y-4 px-6 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="flex-1 space-y-6 px-6 py-2">
          {/* Avatar + name card */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative group active:scale-95 transition-transform"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div className="text-center">
              <p className="text-lg font-semibold">
                {profile?.display_name ?? "No name set"}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1 active:scale-[0.97]"
                onClick={startEditing}
              >
                Edit profile
              </Button>
            )}
          </div>

          {/* Edit form */}
          {editing && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Display name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="pl-10"
                    placeholder="Your name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Phone number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="pl-10"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Address
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="address"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="pl-10"
                    placeholder="123 Main St"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    State
                  </Label>
                  <Input
                    id="state"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Zip code
                  </Label>
                  <Input
                    id="zip"
                    value={formZip}
                    onChange={(e) => setFormZip(e.target.value)}
                    placeholder="90210"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 active:scale-[0.97]"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2 active:scale-[0.97]"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* Account details */}
          <div className="space-y-1">
            <p className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Account
            </p>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.phone || "Not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const p = profile as any;
                      const parts = [p?.address, p?.city, p?.state, p?.zip_code].filter(Boolean);
                      return parts.length > 0 ? parts.join(", ") : "Not set";
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Member since</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate("/admin/roles")}
                    className="flex w-full items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-sm font-medium text-primary">Admin — Manage Roles</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => navigate("/admin/page-access")}
                    className="flex w-full items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-sm font-medium text-primary">Admin — Page Access Control</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => navigate("/admin/privacy-policy")}
                    className="flex w-full items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-sm font-medium text-primary">Admin — Privacy Policies</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-1">
            <p className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Preferences
            </p>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Push notifications</p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      try {
                        const granted = await requestNotificationPermission();
                        if (granted) {
                          if (pushSupported) {
                            try {
                              await subscribePush();
                            } catch {
                              // Service worker may fail in preview — still allow notifications
                            }
                          }
                          setNotificationsEnabled(true);
                          localStorage.setItem("notifications_enabled", "true");
                          toast.success("Notifications enabled");
                        } else {
                          setNotificationsEnabled(false);
                          toast.error("Notification permission was denied");
                        }
                      } catch {
                        toast.error("Could not enable notifications");
                      }
                    } else {
                      setNotificationsEnabled(false);
                      localStorage.setItem("notifications_enabled", "false");
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Locate className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Geofence alerts</p>
                    <p className="text-xs text-muted-foreground">
                      {hasFeatureAccess("geofence_alerts", subscriptionTier)
                        ? "Get notified near brand locations"
                        : "Pro plan required"}
                    </p>
                  </div>
                </div>
                {hasFeatureAccess("geofence_alerts", subscriptionTier) ? (
                  <Switch
                    checked={geofenceEnabled}
                    onCheckedChange={async (checked) => {
                      if (checked) {
                        const granted = await requestNotificationPermission();
                        if (!granted) {
                          toast.error("Enable notifications first");
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          () => {
                            setGeofenceEnabled(true);
                            localStorage.setItem("geofence_enabled", "true");
                            toast.success("Geofence alerts enabled");
                          },
                          () => {
                            toast.error("Location permission is required for geofence alerts");
                          }
                        );
                      } else {
                        setGeofenceEnabled(false);
                        localStorage.setItem("geofence_enabled", "false");
                      }
                    }}
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs active:scale-[0.97]"
                    onClick={() => navigate("/pricing")}
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Upgrade
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Moon className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Dark mode</p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="space-y-1">
            <p className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Subscription
            </p>
            <button
              onClick={() => navigate("/pricing")}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 active:scale-[0.98]"
            >
              <Crown className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium">Plans & Pricing</p>
                <p className="text-xs text-muted-foreground capitalize">{subscriptionTier} plan</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-semibold">Sign out</span>
          </button>

          {/* Delete account */}
        {/* Consent History */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> Privacy Consent History
          </h3>
          <ConsentHistory />
        </div>

        <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98]">
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
                    } catch {
                      toast.error("Failed to delete account");
                    }
                  }}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
