import { useState } from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { HomeWidget } from "@/lib/homeWidgets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: HomeWidget[];
  onSave: (widgets: HomeWidget[]) => void;
}

export default function HomeWidgetEditor({ open, onOpenChange, widgets, onSave }: Props) {
  const [draft, setDraft] = useState<HomeWidget[]>(() => widgets.map((w) => ({ ...w })));

  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = () => {
    onSave(draft);
    onOpenChange(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (v) setDraft(widgets.map((w) => ({ ...w })));
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Edit Home Layout</SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mb-4">
          Toggle visibility and reorder your Home screen widgets.
        </p>

        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {draft.map((widget, i) => (
            <div
              key={widget.id}
              className={`flex items-center gap-2 rounded-xl border p-3 transition-all ${
                widget.visible
                  ? "border-border bg-card"
                  : "border-transparent bg-muted/40 opacity-60"
              }`}
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{widget.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{widget.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 active:scale-90 transition-all"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === draft.length - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 active:scale-90 transition-all"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <Switch
                  checked={widget.visible}
                  onCheckedChange={() => toggle(widget.id)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1 active:scale-[0.97]" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 active:scale-[0.97]" onClick={handleSave}>
            Save layout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
