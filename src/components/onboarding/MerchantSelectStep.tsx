import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";
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
        .eq("show_in_onboarding", true)
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
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-[15px] text-white/60">{description}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl bg-white/10" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-8">No brands available yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {brands.map((b) => {
            const isSelected = selected.has(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggle(b.id)}
                className={`group relative flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all duration-200 active:scale-[0.94] ${
                  isSelected
                    ? "bg-[hsl(220,90%,56%)]/15 ring-1 ring-[hsl(220,90%,56%)]"
                    : "bg-white/[0.06] hover:bg-white/[0.10]"
                }`}
              >
                {isSelected && (
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(220,90%,56%)]">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <span className="text-2xl">{b.logo_emoji}</span>
                <span className="text-xs font-medium text-white/80 text-center leading-tight">{b.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
