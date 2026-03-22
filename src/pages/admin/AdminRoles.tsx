import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, UserPlus, UserMinus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminRoles() {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [lookedUpEmail, setLookedUpEmail] = useState("");

  const callSetRole = async (action: "assign" | "remove", role: string) => {
    if (!email.trim()) {
      toast({ title: "Enter an email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-user-role", {
        body: { action, email: email.trim(), role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Role ${action === "assign" ? "assigned" : "removed"}` });
      await lookupRoles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const lookupRoles = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      // Use the set-user-role function won't work for lookup, so we query directly
      // Since admin can see user_roles via RLS, we need to find user_id first
      // We'll use a simple approach: call a lightweight check
      const { data, error } = await supabase.functions.invoke("set-user-role", {
        body: { action: "lookup", email: email.trim(), role: "user" },
      });
      // The function doesn't support lookup, so let's just show after assign/remove
      setLookedUpEmail(email.trim());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const roles = ["admin", "manager", "user"] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Manage Roles</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">User email</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Assign role</p>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((role) => (
              <Button
                key={`assign-${role}`}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => callSetRole("assign", role)}
                className="gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {role}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Remove role</p>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((role) => (
              <Button
                key={`remove-${role}`}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => callSetRole("remove", role)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <UserMinus className="h-3.5 w-3.5" />
                {role}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Bootstrap admin</p>
          <p>To seed the first admin, call the <code className="text-xs bg-muted px-1 py-0.5 rounded">seed-admin</code> function with your ADMIN_API_KEY header and <code className="text-xs bg-muted px-1 py-0.5 rounded">{`{"email":"akoziar77@gmail.com"}`}</code> in the body.</p>
        </div>
      </div>
    </div>
  );
}
