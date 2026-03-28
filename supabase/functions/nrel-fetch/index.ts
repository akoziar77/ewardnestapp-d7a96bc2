import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

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

    if (!nrelKey) return errorResponse("NREL_API_KEY not configured", 500);

    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    const isAdminKey = adminKey !== "" && adminKey === storedAdminKey;

    if (!isServiceRole && !isAdminKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin } = await userClient.rpc("is_admin");
      if (!isAdmin) return errorResponse("Forbidden – admin only", 403);
    }

    const body = await req.json();
    const { state, zip, radius = 25, fuel_type, paginate = true, max_pages = 50 } = body;

    if (!state && !zip) return errorResponse("Provide either 'state' or 'zip' parameter");

    const db = createClient(supabaseUrl, serviceKey);

    // Fetch brands for matching
    const { data: brands } = await db.from("brands").select("id, name");
    const brandMap = new Map<string, string>();
    for (const b of brands ?? []) brandMap.set(normalize(b.name), b.id);

    const { data: aliases } = await db.from("brand_aliases").select("alias, brand_id");
    for (const a of aliases ?? []) brandMap.set(normalize(a.alias), a.brand_id);

    // In-memory dedup set (for this run only — skip DB pre-load to save memory)
    const seenKeys = new Set<string>();

    let totalFetched = 0;
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: string[] = [];
    let offset = 0;
    let pageCount = 0;

    while (pageCount < max_pages) {
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

      const nrelResp = await fetch(`${NREL_BASE}?${params.toString()}`);
      if (!nrelResp.ok) {
        if (totalFetched === 0) {
          const errText = await nrelResp.text();
          return errorResponse(`NREL API error: ${nrelResp.status} — ${errText}`, 502);
        }
        break;
      }

      const nrelData = await nrelResp.json();
      const stations = nrelData.fuel_stations ?? [];
      totalFetched += stations.length;
      pageCount++;

      const rows: Array<Record<string, unknown>> = [];

      for (const s of stations) {
        const stationName = String(s.station_name ?? "").trim();
        const brandName = extractBrand(stationName, s.ev_network);
        const brandId = brandMap.get(normalize(brandName));

        if (!brandId) { skipped++; continue; }

        const lat = Number(s.latitude);
        const lng = Number(s.longitude);
        if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }

        const key = `${brandId}:${Math.round(lat * 10000)}:${Math.round(lng * 10000)}`;
        if (seenKeys.has(key)) { duplicates++; continue; }
        seenKeys.add(key);

        rows.push({
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
      }

      // Insert in chunks — use upsert-like behavior via onConflict if possible,
      // otherwise just insert and catch errors
      for (let i = 0; i < rows.length; i += 25) {
        const chunk = rows.slice(i, i + 25);
        const { error: insertErr } = await db.from("brand_locations").insert(chunk);
        if (insertErr) {
          // If batch fails, try individual inserts
          for (const row of chunk) {
            const { error: singleErr } = await db.from("brand_locations").insert(row);
            if (singleErr) {
              skipped++;
              if (errors.length < 20) errors.push(singleErr.message);
            } else {
              imported++;
            }
          }
        } else {
          imported += chunk.length;
        }
      }

      if (!paginate || stations.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return jsonResponse({
      status: "success",
      total: totalFetched,
      imported,
      skipped,
      duplicates,
      brands_in_db: brandMap.size,
      pages_fetched: pageCount,
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

function extractBrand(stationName: string, evNetwork?: string): string {
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

  const upper = stationName.toUpperCase();
  for (const brand of knownBrands) {
    if (upper.includes(brand.toUpperCase())) return brand;
  }

  if (evNetwork) {
    const netUpper = evNetwork.toUpperCase();
    if (netUpper.includes("CHARGEPOINT")) return "ChargePoint";
    if (netUpper.includes("TESLA")) return "Tesla Supercharger";
    if (netUpper.includes("ELECTRIFY")) return "Electrify America";
    if (netUpper.includes("EVGO")) return "EVgo";
    if (netUpper.includes("BLINK")) return "Blink";
    if (netUpper.includes("FRANCIS")) return "Francis Energy";
    if (netUpper.includes("VOLTA")) return "Volta";
  }

  return stationName.split(/\s+/).slice(0, 2).join(" ");
}
