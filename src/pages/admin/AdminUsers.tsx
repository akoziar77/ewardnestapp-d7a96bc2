import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, ChevronRight } from "lucide-react";

interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  tier: string;
  nest_points: number;
  account_status: string;
  beta_tester: boolean;
  created_at: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name, display_name, tier, nest_points, account_status, beta_tester, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProfiles((data as ProfileRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = profiles.filter((p) => {
    const term = search.toLowerCase();
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""} ${p.display_name ?? ""}`.toLowerCase();
    return name.includes(term) || p.user_id.toLowerCase().includes(term);
  });

  const getName = (p: ProfileRow) =>
    p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed";

  const statusColor = (s: string) => {
    if (s === "active") return "default";
    if (s === "banned") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Users</h1>
        <Badge variant="secondary" className="ml-auto">{profiles.length}</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No users found</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/admin/users/${p.user_id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {getName(p).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getName(p)}</p>
                <p className="text-xs text-muted-foreground truncate">{p.tier} · {p.nest_points} pts</p>
              </div>
              <Badge variant={statusColor(p.account_status)} className="text-[10px] shrink-0">
                {p.account_status}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
