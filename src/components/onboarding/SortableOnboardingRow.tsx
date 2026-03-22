import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Pencil, Trash2, Copy, Sparkles, type LucideIcon } from "lucide-react";
import {
  Bird, Gift, Bell, QrCode, Star, Heart, Zap, Shield, MapPin,
  Trophy, Crown, Flame, Target, Rocket,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Bird, Gift, Sparkles, Bell, QrCode, Star, Heart, Zap, Shield, MapPin,
  Trophy, Crown, Flame, Target, Rocket,
};

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  color_class: string;
  step_type: string;
  sort_order: number;
  active: boolean;
}

interface Props {
  step: OnboardingStep;
  isSelected: boolean;
  onSelect: () => void;
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (s: OnboardingStep) => void;
  onDuplicate: (s: OnboardingStep) => void;
  onDelete: (s: OnboardingStep) => void;
}

export default function SortableOnboardingRow({
  step, isSelected, onSelect, onToggleActive, onEdit, onDuplicate, onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  const Icon = ICON_MAP[step.icon_name] ?? Sparkles;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border p-4 transition-all cursor-pointer ${
        !step.active ? "opacity-50" : ""
      } ${isDragging ? "shadow-lg ring-2 ring-primary/20" : ""} ${
        isSelected && step.active ? "ring-2 ring-primary" : ""
      }`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${step.color_class}`}>
        <Icon className="h-5 w-5 text-primary-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{step.title}</p>
        <p className="text-xs text-muted-foreground truncate">{step.step_type} · order {step.sort_order}</p>
      </div>

      <Switch
        checked={step.active}
        onCheckedChange={(v) => onToggleActive(step.id, v)}
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); onEdit(step); }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate step"
          onClick={(e) => { e.stopPropagation(); onDuplicate(step); }}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(step); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
