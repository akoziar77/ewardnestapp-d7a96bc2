import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Cake, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => currentYear - i);

interface Props {
  title: string;
  description: string;
}

export default function DobStep({ title, description }: Props) {
  const { user } = useAuth();
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [saved, setSaved] = useState(false);

  const hasAll = month && day && year;

  const save = async () => {
    if (!user || !hasAll) return;
    const monthIdx = MONTHS.indexOf(month) + 1;
    const dob = `${year}-${String(monthIdx).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
    await supabase
      .from("profiles")
      .update({ date_of_birth: dob })
      .eq("user_id", user.id);
    setSaved(true);
  };

  // Save when all three fields are filled
  const handleChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setSaved(false);
    // We'll save on the next render via useEffect-like pattern — but simpler to just save on Continue
  };

  // Expose a way for parent to trigger save — we auto-save when all fields are set
  if (hasAll && !saved) {
    save();
  }

  return (
    <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/10">
          <Cake className="h-10 w-10 text-primary-foreground" />
        </div>
        <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            We use your birthday to send you special rewards and offers on your special day. This is completely optional.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">Month</Label>
            <Select value={month} onValueChange={(v) => handleChange(setMonth, v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Day</Label>
            <Select value={day} onValueChange={(v) => handleChange(setDay, v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Year</Label>
            <Select value={year} onValueChange={(v) => handleChange(setYear, v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        You can skip this and add it later in Settings.
      </p>
    </div>
  );
}
