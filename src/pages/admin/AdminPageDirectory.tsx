import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Pencil, Check, X, Layout, Lock, Unlock, Shield, Users, User } from "lucide-react";
import { usePageAccess, useTogglePageAccess } from "@/hooks/usePageAccess";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface PageEntry {
  key: string;
  label: string;
  path: string;
  section: string;
  roles: Record<string, { id: string; allowed: boolean }>;
}

const ROUTE_MAP: { key: string; path: string; section: string }[] = [
  { key: "home", path: "/", section: "User" },
  { key: "onboarding", path: "/onboarding", section: "User" },
  { key: "scan", path: "/scan", section: "User" },
  { key: "rewards", path: "/rewards", section: "User" },
  { key: "history", path: "/history", section: "User" },
  { key: "profile", path: "/profile", section: "User" },
  { key: "brands", path: "/brands", section: "User" },
  { key: "brands_settings", path: "/brands/settings", section: "User" },
  { key: "manage_tiers", path: "/manage-tiers", section: "Manager" },
  { key: "merchant_onboarding", path: "/merchant/onboarding", section: "Merchant" },
  { key: "merchant_dashboard", path: "/merchant", section: "Merchant" },
  { key: "admin_roles", path: "/admin/roles", section: "Admin" },
  { key: "admin_page_access", path: "/admin/page-access", section: "Admin" },
  { key: "admin_privacy_policy", path: "/admin/privacy-policy", section: "Admin" },
  { key: "admin_quick_actions", path: "/admin/quick-actions", section: "Admin" },
  { key: "admin_onboarding", path: "/admin/onboarding", section: "Admin" },
  { key: "admin_page_directory", path: "/admin/pages", section: "Admin" },
];

const ROLES = ["user", "manager", "admin"] as const;
const ROLE_ICON: Record<string, typeof User> = { user: User, manager: Users, admin: Shield };
const SECTION_ORDER = ["User", "Manager", "Merchant", "Admin"];

export default function AdminPageDirectory() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: accessRows, isLoading } = usePageAccess();
  const toggle = useTogglePageAccess();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const updateLabel = useMutation({
    mutationFn: async ({ key, label }: { key: string; label: string }) => {
      const { error } = await supabase
        .from("page_access")
        .update({ page_label: label })
        .eq("page_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page-access"] });
      toast.success("Label updated");
      setEditingKey(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pages = useMemo<PageEntry[]>(() => {
    if (!accessRows) return [];
    const map = new Map<string, PageEntry>();

    for (const route of ROUTE_MAP) {
      map.set(route.key, {
        key: route.key,
        label: route.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        path: route.path,
        section: route.section,
        roles: {},
      });
    }

    for (const r of accessRows) {
      const entry = map.get(r.page_key);
      if (entry) {
        entry.label = r.page_label;
        entry.roles[r.role_name] = { id: r.id, allowed: r.allowed };
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
    );
  }, [accessRows]);

  const grouped = useMemo(() => {
    const groups: Record<string, PageEntry[]> = {};
    for (const p of pages) {
      (groups[p.section] ??= []).push(p);
    }
    return groups;
  }, [pages]);

  const startEdit = (page: PageEntry) => {
    setEditingKey(page.key);
    setEditLabel(page.label);
  };

  const saveEdit = (key: string) => {
    if (!editLabel.trim()) return;
    updateLabel.mutate({ key, label: editLabel.trim() });
  };

  const handleToggle = (id: string, allowed: boolean) => {
    toggle.mutate({ id, allowed }, {
      onError: (err: any) => toast.error(err.message),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Layout className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Page Directory</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-8">
        <p className="text-sm text-muted-foreground">
          View all pages, edit labels, control access per role, and navigate to any page.
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([section, sectionPages]) => (
            <section key={section}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {section} Pages
              </h2>
              <div className="space-y-2">
                {sectionPages.map((page) => (
                  <div
                    key={page.key}
                    className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: label + path */}
                      <div className="flex-1 min-w-0">
                        {editingKey === page.key ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="h-8 text-sm font-semibold"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(page.key);
                                if (e.key === "Escape") setEditingKey(null);
                              }}
                            />
                            <button
                              onClick={() => saveEdit(page.key)}
                              className="shrink-0 rounded-lg p-1.5 text-primary hover:bg-primary/10 transition-colors active:scale-95"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors active:scale-95"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{page.label}</span>
                            <button
                              onClick={() => startEdit(page)}
                              className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
                              title="Edit label"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{page.path}</p>
                      </div>

                      {/* Right: open link */}
                      <button
                        onClick={() => navigate(page.path)}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all active:scale-95"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </button>
                    </div>

                    {/* Role access toggles */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                      {ROLES.map((role) => {
                        const entry = page.roles[role];
                        const Icon = ROLE_ICON[role];
                        const isAdmin = role === "admin";
                        return (
                          <div key={role} className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs capitalize text-muted-foreground">{role}</span>
                            {entry ? (
                              <Switch
                                checked={entry.allowed}
                                disabled={isAdmin || toggle.isPending}
                                onCheckedChange={(val) => handleToggle(entry.id, val)}
                                className="scale-75 origin-left"
                                aria-label={`${page.label} access for ${role}`}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
