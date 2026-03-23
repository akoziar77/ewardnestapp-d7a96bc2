import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ── HTTP Method Badge ── */
const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  PATCH: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

export function MethodBadge({ method }: { method: string }) {
  const upper = method.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold font-mono",
        methodStyles[upper] ?? "bg-muted text-muted-foreground border-border"
      )}
    >
      {upper}
    </span>
  );
}

/* ── Endpoint Card ── */
interface EndpointProps {
  method: string;
  path: string;
  children?: ReactNode;
}

export function Endpoint({ method, path, children }: EndpointProps) {
  return (
    <div className="rounded-lg border border-border bg-card my-6 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border">
        <MethodBadge method={method} />
        <code className="text-sm font-mono text-foreground">{path}</code>
      </div>
      {children && <div className="p-4 text-sm">{children}</div>}
    </div>
  );
}

/* ── Param Table ── */
interface ParamRow {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Name</th>
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
            <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-4">
                <code className="text-sm font-mono text-foreground">{r.name}</code>
                {r.required && (
                  <span className="ml-1.5 text-[10px] font-medium text-destructive">required</span>
                )}
              </td>
              <td className="py-2.5 pr-4">
                <code className="text-xs font-mono text-muted-foreground">{r.type}</code>
              </td>
              <td className="py-2.5 text-muted-foreground">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
