import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link2, Unlink, RefreshCw, Key, Globe, User } from "lucide-react";

const LOYALTY_PRESETS = [
  { name: "Starbucks Rewards", endpoint: "https://api.starbucks.com/loyalty/v1/balance" },
  { name: "Delta SkyMiles", endpoint: "https://api.delta.com/loyalty/v1/balance" },
  { name: "Marriott Bonvoy", endpoint: "https://api.marriott.com/loyalty/v1/balance" },
  { name: "United MileagePlus", endpoint: "https://api.united.com/loyalty/v1/balance" },
  { name: "Hilton Honors", endpoint: "https://api.hilton.com/loyalty/v1/balance" },
  { name: "Southwest Rapid Rewards", endpoint: "https://api.southwest.com/loyalty/v1/balance" },
  { name: "AMC Stubs", endpoint: "https://api.amctheatres.com/loyalty/v1/balance" },
  { name: "Sephora Beauty Insider", endpoint: "https://api.sephora.com/loyalty/v1/balance" },
] as const;

interface LoyaltyConnection {
  id: string;
  brand_id: string;
  provider_name: string;
  api_endpoint: string | null;
  external_member_id: string | null;
  external_points_balance: number | null;
  status: string;
  last_synced_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  brandName: string;
  brandEmoji: string;
  connection: LoyaltyConnection | null;
  onConnectionChange: () => void;
}

export default function LoyaltyConnectDialog({
  open,
  onOpenChange,
  brandId,
  brandName,
  brandEmoji,
  connection,
  onConnectionChange,
}: Props) {
  const { user } = useAuth();
  const [providerName, setProviderName] = useState("");
  const [isCustomProvider, setIsCustomProvider] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [memberId, setMemberId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!user || !providerName.trim()) {
      toast.error("Provider name is required");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-loyalty", {
        body: {
          action: "connect",
          brand_id: brandId,
          provider_name: providerName.trim(),
          api_endpoint: apiEndpoint.trim() || null,
          access_token: accessToken.trim() || null,
          external_member_id: memberId.trim() || null,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      toast.success(`Connected to ${providerName} loyalty program`);
      onConnectionChange();
      onOpenChange(false);
      resetForm();
    } catch {
      toast.error("Failed to connect loyalty program");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-loyalty", {
        body: { action: "disconnect", brand_id: brandId },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      toast.success("Loyalty program disconnected");
      onConnectionChange();
      onOpenChange(false);
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-loyalty", {
        body: { action: "sync", brand_id: brandId },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      toast.success(
        data.points_balance != null
          ? `Synced! Balance: ${data.points_balance} pts`
          : "Synced successfully"
      );
      onConnectionChange();
    } catch {
      toast.error("Failed to sync");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProviderName("");
    setIsCustomProvider(false);
    setApiEndpoint("");
    setAccessToken("");
    setMemberId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{brandEmoji}</span>
            {connection ? `${brandName} Loyalty` : `Connect ${brandName}`}
          </DialogTitle>
          <DialogDescription>
            {connection
              ? "Manage your external loyalty program connection"
              : "Link an external loyalty program to track your points"}
          </DialogDescription>
        </DialogHeader>

        {connection ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-muted p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Provider
                </span>
                <span className="text-sm font-semibold">{connection.provider_name}</span>
              </div>
              {connection.external_member_id && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Member ID
                  </span>
                  <span className="text-sm font-mono">{connection.external_member_id}</span>
                </div>
              )}
              {connection.external_points_balance != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    External points
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {connection.external_points_balance.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    connection.status === "connected"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {connection.status}
                </span>
              </div>
              {connection.last_synced_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last synced
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(connection.last_synced_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {connection.api_endpoint && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 active:scale-[0.97]"
                  onClick={handleSync}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Sync
                </Button>
              )}
              <Button
                variant="destructive"
                className="flex-1 gap-2 active:scale-[0.97]"
                onClick={handleDisconnect}
                disabled={loading}
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Loyalty program *
              </Label>
              <Select
                value={isCustomProvider ? "__custom__" : providerName}
                onValueChange={(val) => {
                  if (val === "__custom__") {
                    setIsCustomProvider(true);
                    setProviderName("");
                    setApiEndpoint("");
                  } else {
                    setIsCustomProvider(false);
                    setProviderName(val);
                    const preset = LOYALTY_PRESETS.find((p) => p.name === val);
                    if (preset) setApiEndpoint(preset.endpoint);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a program…" />
                </SelectTrigger>
                <SelectContent>
                  {LOYALTY_PRESETS.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Other (custom)</SelectItem>
                </SelectContent>
              </Select>
              {isCustomProvider && (
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="Enter program name"
                    className="pl-10"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Member ID
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  placeholder="Your loyalty member ID"
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              className="w-full gap-2 active:scale-[0.97]"
              onClick={handleConnect}
              disabled={loading || !providerName.trim()}
            >
              <Link2 className="h-4 w-4" />
              {loading ? "Connecting…" : "Connect program"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
