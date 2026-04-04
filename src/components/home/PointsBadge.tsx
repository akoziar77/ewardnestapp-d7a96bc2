import { Shield } from "lucide-react";

interface Props {
  points: number;
  tier: string;
}

export default function PointsBadge({ points, tier }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Shield className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">Points balance</p>
        <p className="text-lg font-bold tabular-nums tracking-tight">
          {points.toLocaleString()}
          <span className="ml-1.5 text-xs font-semibold text-muted-foreground capitalize">{tier}</span>
        </p>
      </div>
    </div>
  );
}
