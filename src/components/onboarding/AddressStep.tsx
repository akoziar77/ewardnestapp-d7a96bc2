import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Info } from "lucide-react";
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

  // Auto-save when user fills in data (called from parent via onDone, but also save on blur)
  const handleBlur = () => {
    if (hasAny && !saved) save();
  };

  return (
    <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/10">
          <MapPin className="h-10 w-10 text-primary-foreground" />
        </div>
        <h2 className="text-balance text-2xl font-bold tracking-tight leading-snug">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your address helps us find nearby deals and partner locations. This is completely optional — you can add or update it later in your profile.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ob-address" className="text-xs">Street address</Label>
          <Input
            id="ob-address"
            placeholder="123 Main St"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setSaved(false); }}
            onBlur={handleBlur}
            autoComplete="street-address"
            className="h-11"
          />
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="ob-city" className="text-xs">City</Label>
            <Input
              id="ob-city"
              placeholder="City"
              value={city}
              onChange={(e) => { setCity(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              autoComplete="address-level2"
              className="h-11"
            />
          </div>
          <div className="col-span-1 space-y-2">
            <Label htmlFor="ob-state" className="text-xs">State</Label>
            <Input
              id="ob-state"
              placeholder="CA"
              value={state}
              onChange={(e) => { setState(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              autoComplete="address-level1"
              className="h-11"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="ob-zip" className="text-xs">Zip code</Label>
            <Input
              id="ob-zip"
              placeholder="90210"
              value={zipCode}
              onChange={(e) => { setZipCode(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              autoComplete="postal-code"
              className="h-11"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        You can skip this and add it later in Settings.
      </p>
    </div>
  );
}
