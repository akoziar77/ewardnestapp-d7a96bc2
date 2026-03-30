import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, UserPlus, UserMinus } from "lucide-react";

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role_id, roles(name)").eq("user_id", userId),
    ]).then(([profileRes, rolesRes]) => {
      setProfile(profileRes.data);
      setRoles((rolesRes.data ?? []).map((r: any) => r.roles?.name).filter(Boolean));
      setLoading(false);
    });
  }, [userId]);

  const callSetRole = async (action: "assign" | "remove", role: string) => {
    if (!profile) return;
    setRoleLoading(true);
    try {
      // We need to find the user's email — use a workaround via the edge function
      const { data, error } = await supabase.functions.invoke("set-user-role", {
        body: { action, user_id: userId, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Role ${action === "assign" ? "assigned" : "removed"}` });
      // Refresh roles
      const { data: refreshed } = await supabase.from("user_roles").select("role_id, roles(name)").eq("user_id", userId!);
      setRoles((refreshed ?? []).map((r: any) => r.roles?.name).filter(Boolean));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRoleLoading(false);
    }
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">Loading…</p>;
  if (!profile) return <p className="text-center py-12 text-muted-foreground">User not found</p>;

  const getName = () =>
    profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unnamed";

  const sections: { label: string; rows: { key: string; value: any }[] }[] = [
    {
      label: "Identity",
      rows: [
        { key: "Name", value: getName() },
        { key: "User ID", value: profile.user_id },
        { key: "Phone", value: profile.phone || "—" },
        { key: "DOB", value: profile.date_of_birth || "—" },
        { key: "Address", value: [profile.address, profile.city, profile.state, profile.zip_code].filter(Boolean).join(", ") || "—" },
      ],
    },
    {
      label: "Account",
      rows: [
        { key: "Status", value: profile.account_status },
        { key: "Tier", value: profile.tier },
        { key: "Nest Points", value: profile.nest_points },
        { key: "Streak", value: profile.streak_count },
        { key: "Challenges Done", value: profile.challenges_completed },
        { key: "Onboarding", value: profile.onboarding_completed ? "✅" : "❌" },
        { key: "Joined", value: new Date(profile.created_at).toLocaleDateString() },
      ],
    },
    {
      label: "Notifications",
      rows: [
        { key: "Push", value: profile.push_notifications ? "On" : "Off" },
        { key: "Email", value: profile.email_notifications ? "On" : "Off" },
        { key: "SMS", value: profile.sms_notifications ? "On" : "Off" },
      ],
    },
    {
      label: "Device & Beta",
      rows: [
        { key: "Device", value: profile.device_type || "—" },
        { key: "PWA Installed", value: profile.pwa_installed ? "Yes" : "No" },
        { key: "Beta Tester", value: profile.beta_tester ? "Yes" : "No" },
        { key: "Test Group", value: profile.test_group },
        { key: "Sessions", value: profile.session_count },
      ],
    },
    {
      label: "Referrals",
      rows: [
        { key: "Referral Code", value: profile.referral_code || "—" },
        { key: "Referred By", value: profile.referred_by || "—" },
      ],
    },
  ];

  const allRoleOptions = ["admin", "manager", "user"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/admin/users")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
          {getName().charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">{getName()}</h1>
          <p className="text-xs text-muted-foreground">{profile.tier} · {profile.nest_points} pts</p>
        </div>
      </div>

      {/* Roles management */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Roles</span>
          {roles.map((r) => (
            <Badge key={r} variant="default" className="text-[10px]">{r}</Badge>
          ))}
          {roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {allRoleOptions.map((role) => {
            const has = roles.includes(role);
            return (
              <Button
                key={role}
                variant="outline"
                size="sm"
                disabled={roleLoading}
                onClick={() => callSetRole(has ? "remove" : "assign", role)}
                className={`gap-1 text-xs ${has ? "text-destructive" : ""}`}
              >
                {has ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                {has ? `Remove ${role}` : `Add ${role}`}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Profile sections */}
      {sections.map((section) => (
        <div key={section.label} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 bg-muted/30 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</span>
          </div>
          <div className="divide-y divide-border">
            {section.rows.map((row) => (
              <div key={row.key} className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{row.key}</span>
                <span className="text-sm font-medium text-right max-w-[60%] truncate">{String(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
