import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

/**
 * NREL API FETCH — Fuel Station Location Import with Pagination
 * Fetches ALL fuel station data from NREL Alternative Fuel Station Locator API
 * and imports matching stations into brand_locations.
 *
 * Body params:
 *   state     — 2-letter state code (e.g. "TX")
 *   zip       — ZIP code for radius search
 *   radius    — radius in miles (default 25, max 100)
 *   fuel_type — NREL fuel_type_code filter
 *   paginate  — if true, auto-paginate through all results (default true)
 */

const NREL_BASE = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json";
const PAGE_SIZE = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const adminKey = req.headers.get("x-admin-key") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const nrelKey = Deno.env.get("NREL_API_KEY");
    const storedAdminKey = Deno.env.get("ADMIN_API_KEY") ?? "";

    if (!nrelKey) {
      return errorResponse("NREL_API_KEY not configured", 500);
    }

    // Auth: either service_role bearer OR x-admin-key header OR admin RPC
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    const isAdminKey = adminKey !== "" && adminKey === storedAdminKey;

    if (!isServiceRole && !isAdminKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin } = await userClient.rpc("is_admin");
      if (!isAdmin) {
        return errorResponse("Forbidden – admin only", 403);
      }
    }

    const body = await req.json();
    const { state, zip, radius = 25, fuel_type, paginate = true } = body;

    if (!state && !zip) {
      return errorResponse("Provide either 'state' or 'zip' parameter");
    }

    // Service role client for inserts
    const db = createClient(supabaseUrl, serviceKey);

    // Fetch ALL brands (not just Gas category) for matching
    const { data: brands } = await db
      .from("brands")
      .select("id, name");

    const brandMap = new Map<string, string>();
    for (const b of brands ?? []) {
      brandMap.set(normalize(b.name), b.id);
    }

    // Also build alias map from brand_aliases
    const { data: aliases } = await db
      .from("brand_aliases")
      .select("alias, brand_id");
    for (const a of aliases ?? []) {
      brandMap.set(normalize(a.alias), a.brand_id);
    }

    let totalFetched = 0;
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        api_key: nrelKey,
        status: "E",
        access: "public",
        limit: String(PAGE_SIZE),
        offset: String(offset),
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
        if (totalFetched === 0) {
          return errorResponse(`NREL API error: ${nrelResp.status} — ${errText}`, 502);
        }
        break; // partial success
      }

      const nrelData = await nrelResp.json();
      const stations = nrelData.fuel_stations ?? [];
      totalFetched += stations.length;

      // Process stations in this page
      for (const s of stations) {
        try {
          const stationName = String(s.station_name ?? "").trim();
          const brandName = extractBrand(stationName, s.groups_with_access_code, s.ev_network);
          const brandKey = normalize(brandName);
          const brandId = brandMap.get(brandKey);

          if (!brandId) {
            skipped++;
            if (errors.length < 50) errors.push(`No brand: "${brandName}" (${stationName})`);
            continue;
          }

          const lat = Number(s.latitude);
          const lng = Number(s.longitude);
          if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }

          // Duplicate check (~10m radius)
          const { count } = await db
            .from("brand_locations")
            .select("id", { count: "exact", head: true })
            .eq("brand_id", brandId)
            .gte("latitude", lat - 0.0001)
            .lte("latitude", lat + 0.0001)
            .gte("longitude", lng - 0.0001)
            .lte("longitude", lng + 0.0001);

          if ((count ?? 0) > 0) { skipped++; continue; }

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
            if (errors.length < 50) errors.push(`Insert: ${insertErr.message}`);
          } else {
            imported++;
          }
        } catch (e) {
          skipped++;
          if (errors.length < 50) errors.push(`Error: ${e.message}`);
        }
      }

      // Pagination logic
      if (!paginate || stations.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    return jsonResponse({
      status: "success",
      total: totalFetched,
      imported,
      skipped,
      brands_matched: brandMap.size,
      pages_fetched: Math.ceil(totalFetched / PAGE_SIZE) || 1,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    console.error("NREL FETCH ERROR:", err);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractBrand(stationName: string, groupCode?: string, evNetwork?: string): string {
  const knownBrands = [
    "Shell", "BP", "Chevron", "ExxonMobil", "Exxon", "Mobil",
    "Valero", "Marathon", "Sunoco", "Phillips 66", "Citgo",
    "Casey's", "QuikTrip", "Wawa", "Sheetz", "RaceTrac",
    "Speedway", "Circle K", "7-Eleven", "Murphy", "Costco",
    "Sam's Club", "BJ's", "Kroger", "HEB", "Buc-ee's",
    "Pilot", "Flying J", "Love's", "Cumberland Farms",
    "Giant Eagle", "Meijer", "U-Haul",
    "Clean Energy", "ChargePoint", "Tesla Supercharger", "Tesla",
    "Electrify America", "EVgo", "Blink", "Francis Energy",
    "Volta", "Ferrellgas", "TG Fuels",
  ];

  // Check station name first
  const upper = stationName.toUpperCase();
  for (const brand of knownBrands) {
    if (upper.includes(brand.toUpperCase())) {
      return brand;
    }
  }

  // Check EV network field (NREL provides this for EV stations)
  if (evNetwork) {
    const netUpper = evNetwork.toUpperCase();
    const evBrands = [
      "ChargePoint", "Tesla", "Electrify America", "EVgo",
      "Blink", "Francis Energy", "Volta", "Clean Energy",
    ];
    for (const brand of evBrands) {
      if (netUpper.includes(brand.toUpperCase())) {
        return brand;
      }
    }
  }

  // Fallback: use first word(s) of station name
  return stationName.split(/\s+/).slice(0, 2).join(" ");
}
