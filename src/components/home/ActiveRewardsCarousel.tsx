import useEmblaCarousel from "embla-carousel-react";
import { Gift } from "lucide-react";

interface RewardItem {
  id: string;
  title: string;
  points_cost: number;
  description?: string | null;
  merchantName?: string;
}

interface Props {
  rewards: RewardItem[];
  onTap?: (reward: RewardItem) => void;
}

export default function ActiveRewardsCarousel({ rewards, onTap }: Props) {
  const [emblaRef] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });

  if (!rewards.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Gift className="h-3.5 w-3.5 text-primary" />
        Active rewards
      </h2>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {rewards.map((r) => (
            <button
              key={r.id}
              onClick={() => onTap?.(r)}
              className="flex-none w-[200px] rounded-2xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
            >
              <p className="text-sm font-bold truncate">{r.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {r.merchantName ?? r.description ?? ""}
              </p>
              <p className="mt-2 text-sm font-semibold text-primary tabular-nums">
                {r.points_cost.toLocaleString()} pts
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
