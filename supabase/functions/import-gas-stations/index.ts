import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

/**
 * IMPORT GAS STATION LOCATIONS
 * Accepts JSON or CSV payload, matches to existing brands by name,
 * and inserts into brand_locations.
 *
 * Expected station fields:
 *   name, brand, address, city, state, zip, lat, lng
 *
 * Auth: requires admin role (validated via is_admin() RPC)
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await userClient.rpc("is_admin");
    if (!isAdmin) {
      return errorResponse("Forbidden – admin only", 403);
    }

    // Service role client for inserts
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { sourceType = "json", payload } = body;

    // ── 1. PARSE INPUT ──────────────────────────────────
    let stations: Record<string, unknown>[] = [];

    if (sourceType === "json") {
      stations = Array.isArray(payload) ? payload : [];
    } else if (sourceType === "csv") {
      stations = parseCsv(payload as string);
    }

    if (!stations.length) {
      return errorResponse("No station data found");
    }

    // ── 2. FETCH EXISTING BRANDS (Gas category) ─────────
    const { data: brands } = await db
      .from("brands")
      .select("id, name")
      .eq("category", "Gas");

    const brandMap = new Map<string, string>();
    for (const b of brands ?? []) {
      brandMap.set(normalize(b.name), b.id);
    }

    // ── 3. IMPORT LOCATIONS ─────────────────────────────
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const s of stations) {
      try {
        const brandName = String(s.brand ?? "").trim();
        const brandKey = normalize(brandName);
        const brandId = brandMap.get(brandKey);

        if (!brandId) {
          skipped++;
          errors.push(`No matching brand for "${brandName}"`);
          continue;
        }

        const lat = Number(s.lat);
        const lng = Number(s.lng);

        if (isNaN(lat) || isNaN(lng)) {
          skipped++;
          errors.push(`Invalid coords for "${s.name}"`);
          continue;
        }

        // Check for duplicate by coordinates (within ~10m)
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
          name: String(s.name ?? `${brandName} Station`),
          address_line: String(s.address ?? ""),
          city: String(s.city ?? ""),
          state: String(s.state ?? ""),
          zip_code: String(s.zip ?? ""),
          country: "US",
          latitude: lat,
          longitude: lng,
        });

        if (insertErr) {
          skipped++;
          errors.push(`Insert failed for "${s.name}": ${insertErr.message}`);
        } else {
          imported++;
        }
      } catch (e) {
        skipped++;
        errors.push(`Error processing station: ${e.message}`);
      }
    }

    return jsonResponse({
      status: "success",
      total: stations.length,
      imported,
      skipped,
      brands_matched: brandMap.size,
      errors: errors.slice(0, 20), // cap error list
    });
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

// ── HELPERS ───────────────────────────────────────────────

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(raw: string): Record<string, unknown>[] {
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}
