import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePageAccess, useTogglePageAccess } from "@/hooks/usePageAccess";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLES = ["user", "manager", "admin"] as const;

export default function AdminPageAccess() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: rows, isLoading } = usePageAccess();
  const toggle = useTogglePageAccess();

  // Group rows by page_key preserving label
  const pages = useMemo(() => {
    if (!rows) return [];
    const map = new Map<string, { key: string; label: string; roles: Record<string, { id: string; allowed: boolean }> }>();
    for (const r of rows) {
      if (!map.has(r.page_key)) {
        map.set(r.page_key, { key: r.page_key, label: r.page_label, roles: {} });
      }
      map.get(r.page_key)!.roles[r.role_name] = { id: r.id, allowed: r.allowed };
    }
    return Array.from(map.values());
  }, [rows]);

  const handleToggle = (id: string, allowed: boolean) => {
    toggle.mutate(
      { id, allowed },
      {
        onError: (err: any) =>
          toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Page Access Control</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground mb-6">
          Toggle which roles can access each page. Admins always have full access regardless of these settings.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Page</TableHead>
                  {ROLES.map((role) => (
                    <TableHead key={role} className="text-center font-semibold capitalize w-28">
                      {role}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.key}>
                    <TableCell className="font-medium">{page.label}</TableCell>
                    {ROLES.map((role) => {
                      const entry = page.roles[role];
                      if (!entry) return <TableCell key={role} className="text-center">—</TableCell>;
                      const isAdmin = role === "admin";
                      return (
                        <TableCell key={role} className="text-center">
                          <Switch
                            checked={entry.allowed}
                            disabled={isAdmin || toggle.isPending}
                            onCheckedChange={(val) => handleToggle(entry.id, val)}
                            aria-label={`${page.label} access for ${role}`}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
