import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
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

  const handleChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setSaved(false);
  };

  if (hasAll && !saved) {
    save();
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-[15px] text-white/60 max-w-[300px] mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.06] p-4 space-y-4">
        <div className="flex items-start gap-2 rounded-xl bg-white/[0.04] p-3">
          <Info className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
          <p className="text-xs text-white/40 leading-relaxed">
            We use your birthday to send you special rewards. This is completely optional.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <Label className="text-xs text-white/60">Month</Label>
            <Select value={month} onValueChange={(v) => handleChange(setMonth, v)}>
              <SelectTrigger className="h-11 bg-white/[0.06] border-white/10 text-white">
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
            <Label className="text-xs text-white/60">Day</Label>
            <Select value={day} onValueChange={(v) => handleChange(setDay, v)}>
              <SelectTrigger className="h-11 bg-white/[0.06] border-white/10 text-white">
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
            <Label className="text-xs text-white/60">Year</Label>
            <Select value={year} onValueChange={(v) => handleChange(setYear, v)}>
              <SelectTrigger className="h-11 bg-white/[0.06] border-white/10 text-white">
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

      <p className="text-xs text-white/30 text-center mt-4">
        You can skip this and add it later in Settings.
      </p>
    </div>
  );
}
