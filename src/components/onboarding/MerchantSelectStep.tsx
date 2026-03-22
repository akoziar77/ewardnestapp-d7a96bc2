import { useState } from "react";
import { Check, QrCode } from "lucide-react";

const DEMO_MERCHANTS = [
  { name: "Brew & Bean", category: "Coffee", emoji: "☕" },
  { name: "FreshMart", category: "Grocery", emoji: "🛒" },
  { name: "Glow Studio", category: "Beauty", emoji: "💆" },
  { name: "Pedal Co.", category: "Fitness", emoji: "🚴" },
  { name: "BookNook", category: "Books", emoji: "📚" },
  { name: "Sushi Spot", category: "Dining", emoji: "🍣" },
];

interface Props {
  title: string;
  description: string;
}

export default function MerchantSelectStep({ title, description }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary shadow-lg shadow-secondary/10">
          <QrCode className="h-10 w-10 text-secondary-foreground" />
        </div>
        <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {DEMO_MERCHANTS.map((m, i) => {
          const isSelected = selected.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.96] ${
                isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              {isSelected && (
                <div className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <span className="text-3xl">{m.emoji}</span>
              <span className="text-sm font-medium">{m.name}</span>
              <span className="text-xs text-muted-foreground">{m.category}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
