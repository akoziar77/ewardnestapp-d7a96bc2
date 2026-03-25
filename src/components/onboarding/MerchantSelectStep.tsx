import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, QrCode } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  title: string;
  description: string;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export default function MerchantSelectStep({ title, description, onSelectionChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["onboarding-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, logo_emoji, category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      onSelectionChange?.(Array.from(next));
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

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No brands available yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
          {brands.map((b) => {
            const isSelected = selected.has(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggle(b.id)}
                className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.96] ${
                  isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {isSelected && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <span className="text-3xl">{b.logo_emoji}</span>
                <span className="text-sm font-medium">{b.name}</span>
                {b.category && <span className="text-xs text-muted-foreground">{b.category}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
