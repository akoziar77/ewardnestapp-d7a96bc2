import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Info, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  title: string;
  description: string;
}

async function lookupZip(zip: string): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    return { city: place["place name"], state: place["state abbreviation"] };
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<{
  address: string; city: string; state: string; zip: string;
} | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address;
    if (!a) return null;
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    return {
      address: street || "",
      city: a.city || a.town || a.village || a.hamlet || "",
      state: a.state || "",
      zip: a.postcode || "",
    };
  } catch {
    return null;
  }
}

// Map full state names to abbreviations
const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

export default function AddressStep({ title, description }: Props) {
  const { user } = useAuth();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

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

  const handleZipChange = useCallback(async (val: string) => {
    setZipCode(val);
    setSaved(false);
    if (val.length === 5 && /^\d{5}$/.test(val)) {
      setZipLoading(true);
      const result = await lookupZip(val);
      if (result) {
        setCity(result.city);
        setState(result.state);
      }
      setZipLoading(false);
    }
  }, []);

  const useCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (geo) {
          setAddress(geo.address);
          setCity(geo.city);
          setState(STATE_ABBR[geo.state] || geo.state);
          setZipCode(geo.zip);
          setSaved(false);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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

        {/* Use current location button */}
        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          disabled={locating}
          className="w-full h-10 gap-2 bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          {locating ? "Finding your location…" : "Use current location"}
        </Button>

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
            <Label htmlFor="ob-zip" className="text-xs text-white/60">Zip</Label>
            <div className="relative">
              <Input
                id="ob-zip"
                placeholder="90210"
                value={zipCode}
                onChange={(e) => handleZipChange(e.target.value)}
                onBlur={handleBlur}
                autoComplete="postal-code"
                maxLength={5}
                className="h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(220,90%,56%)]"
              />
              {zipLoading && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-white/40" />
              )}
            </div>
          </div>
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
        </div>
      </div>

      <p className="text-xs text-white/30 text-center mt-4">
        You can skip this and add it later in Settings.
      </p>
    </div>
  );
}
