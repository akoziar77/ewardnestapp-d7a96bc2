import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

/**
 * NREL API FETCH — Gas Station Location Import
 * Fetches gas/fuel station data from NREL Alternative Fuel Station Locator API
 * and imports matching stations into brand_locations.
 *
 * Body params:
 *   state   — 2-letter state code (e.g. "TX")
 *   zip     — ZIP code for radius search
 *   radius  — radius in miles (default 25, max 100)
 *   limit   — max results (default 200, max 500)
 *   fuel_type — NREL fuel_type_code (default "ELEC,E85,BD,CNG,LNG,LPG,HY" — all types)
 */

const NREL_BASE = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const nrelKey = Deno.env.get("NREL_API_KEY");

    if (!nrelKey) {
      return errorResponse("NREL_API_KEY not configured", 500);
    }

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await userClient.rpc("is_admin");
    if (!isAdmin) {
      return errorResponse("Forbidden – admin only", 403);
    }

    const body = await req.json();
    const { state, zip, radius = 25, limit = 200, fuel_type } = body;

    if (!state && !zip) {
      return errorResponse("Provide either 'state' or 'zip' parameter");
    }

    // Build NREL API URL
    const params = new URLSearchParams({
      api_key: nrelKey,
      status: "E", // open stations only
      access: "public",
      limit: String(Math.min(Number(limit), 200)),
    });

    if (state) params.set("state", state);
    if (zip) {
      params.set("zip", zip);
      params.set("radius", String(Math.min(Number(radius), 100)));
    }
    if (fuel_type) params.set("fuel_type", fuel_type);

    const nrelUrl = `${NREL_BASE}?${params.toString()}`;
    const nrelResp = await fetch(nrelUrl);

    if (!nrelResp.ok) {
      const errText = await nrelResp.text();
      return errorResponse(`NREL API error: ${nrelResp.status} — ${errText}`, 502);
    }

    const nrelData = await nrelResp.json();
    const stations = nrelData.fuel_stations ?? [];

    if (!stations.length) {
      return jsonResponse({ status: "success", total: 0, imported: 0, skipped: 0, message: "No stations found for the given parameters" });
    }

    // Service role client for inserts
    const db = createClient(supabaseUrl, serviceKey);

    // Fetch existing Gas brands for matching
    const { data: brands } = await db
      .from("brands")
      .select("id, name")
      .eq("category", "Gas");

    const brandMap = new Map<string, string>();
    for (const b of brands ?? []) {
      brandMap.set(normalize(b.name), b.id);
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const s of stations) {
      try {
        const stationName = String(s.station_name ?? "").trim();
        // Try to match brand from station_name or groups_with_access_code
        const brandName = extractBrand(stationName, s.groups_with_access_code);
        const brandKey = normalize(brandName);
        const brandId = brandMap.get(brandKey);

        if (!brandId) {
          skipped++;
          if (errors.length < 20) errors.push(`No matching brand for "${brandName}" (station: ${stationName})`);
          continue;
        }

        const lat = Number(s.latitude);
        const lng = Number(s.longitude);
        if (isNaN(lat) || isNaN(lng)) {
          skipped++;
          continue;
        }

        // Duplicate check (~10m radius)
        const { count } = await db
          .from("brand_locations")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brandId)
          .gte("latitude", lat - 0.0001)
          .lte("latitude", lat + 0.0001)
          .gte("longitude", lng - 0.0001)
          .lte("longitude", lng + 0.0001);

        if ((count ?? 0) > 0) {
          skipped++;
          continue;
        }

        const { error: insertErr } = await db.from("brand_locations").insert({
          brand_id: brandId,
          name: stationName || `${brandName} Station`,
          address_line: String(s.street_address ?? ""),
          city: String(s.city ?? ""),
          state: String(s.state ?? ""),
          zip_code: String(s.zip ?? ""),
          country: "US",
          latitude: lat,
          longitude: lng,
        });

        if (insertErr) {
          skipped++;
          if (errors.length < 20) errors.push(`Insert failed: ${insertErr.message}`);
        } else {
          imported++;
        }
      } catch (e) {
        skipped++;
        if (errors.length < 20) errors.push(`Error: ${e.message}`);
      }
    }

    return jsonResponse({
      status: "success",
      total: stations.length,
      imported,
      skipped,
      brands_matched: brandMap.size,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("NREL FETCH ERROR:", err);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractBrand(stationName: string, groupCode?: string): string {
  // Common gas brand keywords to look for in station name
  const knownBrands = [
    "Shell", "BP", "Chevron", "ExxonMobil", "Exxon", "Mobil",
    "Valero", "Marathon", "Sunoco", "Phillips 66", "Citgo",
    "Casey's", "QuikTrip", "Wawa", "Sheetz", "RaceTrac",
    "Speedway", "Circle K", "7-Eleven", "Murphy", "Costco",
    "Sam's Club", "BJ's", "Kroger", "HEB", "Buc-ee's",
    "Pilot", "Flying J", "Love's", "TA", "Petro",
  ];

  const upper = stationName.toUpperCase();
  for (const brand of knownBrands) {
    if (upper.includes(brand.toUpperCase())) {
      return brand;
    }
  }

  // Fallback: use first word(s) of station name
  return stationName.split(/\s+/).slice(0, 2).join(" ");
}
