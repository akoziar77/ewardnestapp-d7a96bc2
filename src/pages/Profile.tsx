import { useState, useRef } from "react";
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
  Trash2,
  Crown,
  FileText,
  Heart,
  Tag,
  Clock,
  Archive,
  Settings,
  Database,
  ThumbsUp,
  Send,
  Lightbulb,
  MailIcon,
  Locate,
} from "lucide-react";
import { requestNotificationPermission } from "@/hooks/useGeofence";
import { hasFeatureAccess } from "@/lib/featureGates";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import ConsentHistory from "@/components/ConsentHistory";

interface MenuRow {
  icon: React.ElementType;
  color: string;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}

function MenuGroup({ rows }: { rows: MenuRow[] }) {
  return (
    <div className="rounded-2xl bg-muted/50 overflow-hidden divide-y divide-border/50">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <button
            key={row.label}
            onClick={row.onClick}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted active:scale-[0.98]"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.color} text-white`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="flex-1 text-[15px] font-medium text-foreground">{row.label}</span>
            {row.trailing ?? <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

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
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url }).eq("user_id", user.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Avatar updated");
    } catch { toast.error("Failed to upload avatar"); } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials = (profile?.display_name ?? user?.email ?? "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="text-center text-xl font-bold text-foreground">Profile</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4 px-4 py-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="max-w-lg mx-auto w-full flex-1 space-y-5 px-4 py-5">

          {/* Avatar + Name card — mimics Folio's sign-in banner */}
          <div className="rounded-2xl bg-muted/50 p-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative group active:scale-95 transition-transform shrink-0"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white text-lg font-bold">
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-4 w-4 text-white" />
                </div>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-foreground truncate">
                  {profile?.display_name ?? "No name set"}
                </p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            {!editing && (
              <button
                onClick={startEditing}
                className="mt-3 text-sm font-semibold text-primary hover:underline"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Edit form */}
          {editing && (
            <div className="space-y-4 rounded-2xl bg-muted/50 p-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="pl-10" placeholder="Your name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="pl-10" placeholder="+1 (555) 000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="pl-10" placeholder="123 Main St" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</Label>
                  <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="City" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">State</Label>
                  <Input value={formState} onChange={(e) => setFormState(e.target.value)} placeholder="CA" maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Zip</Label>
                  <Input value={formZip} onChange={(e) => setFormZip(e.target.value)} placeholder="90210" maxLength={10} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 active:scale-[0.97]" onClick={() => setEditing(false)}>Cancel</Button>
                <Button className="flex-1 gap-2 active:scale-[0.97]" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* Favorites / Organization group */}
          <MenuGroup
            rows={[
              { icon: Heart, color: "bg-red-500", label: "Favorites", onClick: () => navigate("/brands") },
              { icon: Tag, color: "bg-green-500", label: "Labels" },
              { icon: Clock, color: "bg-blue-500", label: "Expired" },
              { icon: Archive, color: "bg-indigo-500", label: "Archived", onClick: () => navigate("/profile/archived") },
              { icon: Trash2, color: "bg-indigo-500", label: "Recently Deleted", onClick: () => navigate("/profile/deleted") },
            ]}
          />

          {/* Settings group */}
          <MenuGroup
            rows={[
              {
                icon: Bell, color: "bg-gray-600", label: "Notifications",
                trailing: (
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
                ),
              },
              {
                icon: Moon, color: "bg-gray-600", label: "Dark Mode",
                trailing: (
                  <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
                ),
              },
              {
                icon: Locate, color: "bg-gray-600", label: "Geofence Alerts",
                trailing: hasFeatureAccess("geofence_alerts", subscriptionTier) ? (
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
                ),
              },
              { icon: Settings, color: "bg-gray-600", label: "Settings", onClick: () => navigate("/profile/settings") },
              { icon: Database, color: "bg-gray-600", label: "Data and Storage" },
            ]}
          />

          {/* Subscription */}
          <MenuGroup
            rows={[
              { icon: Crown, color: "bg-amber-500", label: `Plans & Pricing (${subscriptionTier})`, onClick: () => navigate("/pricing") },
              ...(isAdmin ? [{ icon: Shield as React.ElementType, color: "bg-blue-600", label: "Admin Dashboard", onClick: () => navigate("/admin") }] : []),
            ]}
          />

          {/* Community group */}
          <MenuGroup
            rows={[
              { icon: ThumbsUp, color: "bg-green-500", label: "Rate App" },
              { icon: Send, color: "bg-blue-500", label: "Tell a Friend" },
              { icon: Lightbulb, color: "bg-yellow-500", label: "Share an Idea" },
              { icon: MailIcon, color: "bg-purple-500", label: "Contact Support" },
            ]}
          />

          {/* Privacy consent */}
          <div className="rounded-2xl bg-muted/50 p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> Privacy Consent History
            </h3>
            <ConsentHistory />
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
      )}

      <BottomNav />
    </div>
  );
}
