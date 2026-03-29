import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  title: string;
  description: string;
}

export default function AddressStep({ title, description }: Props) {
  const { user } = useAuth();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [saved, setSaved] = useState(false);

  const hasAny = address || city || state || zipCode;

  const save = async () => {
    if (!user || !hasAny) return;
    await supabase
      .from("profiles")
      .update({ address, city, state, zip_code: zipCode })
      .eq("user_id", user.id);
    setSaved(true);
  };

  const handleBlur = () => {
    if (hasAny && !saved) save();
  };

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

      <div className="rounded-2xl bg-white/[0.06] p-4 space-y-3">
        <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.08] p-3.5">
          <Info className="h-4 w-4 text-white/50 shrink-0 mt-0.5" />
          <p className="text-sm text-white/60 leading-relaxed">
            Your address helps us find nearby deals. This is completely optional.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ob-address" className="text-xs text-white/60">Street address</Label>
          <Input
            id="ob-address"
            placeholder="123 Main St"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setSaved(false); }}
            onBlur={handleBlur}
            autoComplete="street-address"
            className="h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(220,90%,56%)]"
          />
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="ob-city" className="text-xs text-white/60">City</Label>
            <Input
              id="ob-city"
              placeholder="City"
              value={city}
              onChange={(e) => { setCity(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              autoComplete="address-level2"
              className="h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(220,90%,56%)]"
            />
          </div>
          <div className="col-span-1 space-y-2">
            <Label htmlFor="ob-state" className="text-xs text-white/60">State</Label>
            <Input
              id="ob-state"
              placeholder="CA"
              value={state}
              onChange={(e) => { setState(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              autoComplete="address-level1"
              className="h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(220,90%,56%)]"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="ob-zip" className="text-xs text-white/60">Zip</Label>
            <Input
              id="ob-zip"
              placeholder="90210"
              value={zipCode}
              onChange={(e) => { setZipCode(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              autoComplete="postal-code"
              className="h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(220,90%,56%)]"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-white/30 text-center mt-4">
        You can skip this and add it later in Settings.
      </p>
    </div>
  );
}
