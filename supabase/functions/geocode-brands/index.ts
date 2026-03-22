import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "EwardNestApp/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find brands with address but no coordinates
    const { data: brands, error } = await adminClient
      .from("brands")
      .select("id, name, address_line")
      .not("address_line", "is", null)
      .is("latitude", null);

    if (error) throw error;

    const results: { id: string; name: string; status: string }[] = [];

    for (const brand of brands ?? []) {
      if (!brand.address_line) continue;

      // Rate limit: Nominatim asks for 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));

      const coords = await geocodeAddress(brand.address_line);
      if (coords) {
        const { error: updateError } = await adminClient
          .from("brands")
          .update({ latitude: coords.lat, longitude: coords.lon })
          .eq("id", brand.id);

        results.push({
          id: brand.id,
          name: brand.name,
          status: updateError ? `error: ${updateError.message}` : "geocoded",
        });
      } else {
        results.push({ id: brand.id, name: brand.name, status: "not_found" });
      }
    }

    return new Response(JSON.stringify({ geocoded: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
