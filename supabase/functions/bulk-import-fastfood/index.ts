import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

/**
 * BULK IMPORT – Fast Food (or any category)
 *
 * Accepts JSON or CSV payload with fields:
 *   name, brand, address, city, state, zip, lat, lng, externalId?
 *
 * 1. Parses input (JSON array or CSV string)
 * 2. Upserts brands by normalized_name (unique)
 * 3. Bulk-inserts locations, skipping duplicates via external_id
 * 4. Optional merge pass to update changed fields on existing rows
 *
 * Auth: admin only (JWT or x-admin-key)
 */

const BATCH_SIZE = 500;
const UPDATE_BATCH_SIZE = 200;

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
    const storedAdminKey = Deno.env.get("ADMIN_API_KEY") ?? "";

    // Auth check
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    const isAdminKey = adminKey !== "" && adminKey === storedAdminKey;

    if (!isServiceRole && !isAdminKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin } = await userClient.rpc("is_admin");
      if (!isAdmin) return errorResponse("Forbidden – admin only", 403);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const {
      sourceType = "json",
      payload,
      category = "Fast Food",
      doMerge = true,
    } = body;

    // ── 1. PARSE INPUT ──────────────────────────────────
    type Row = Record<string, unknown>;
    let rows: Row[] = [];

    if (sourceType === "json") {
      rows = Array.isArray(payload) ? payload : [];
    } else if (sourceType === "csv") {
      rows = parseCsv(String(payload));
    } else {
      return errorResponse("sourceType must be 'json' or 'csv'", 400);
    }

    if (!rows.length) return errorResponse("No rows to import", 400);

    // ── 2. NORMALIZE & VALIDATE ─────────────────────────
    const brandKeys = new Map<string, string>(); // normalizedName -> rawName
    const locations: {
      externalId: string;
      name: string;
      brandKey: string;
      brandName: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      lat: number;
      lng: number;
    }[] = [];

    for (const r of rows) {
      const brandName = String(r.brand ?? "Unknown").trim();
      const brandKey = normalize(brandName);
      const lat = toNumber(r.lat);
      const lng = toNumber(r.lng);
      if (lat === null || lng === null) continue;

      const externalId =
        String(r.externalId ?? "").trim() || `${brandKey}-${lat}-${lng}`;

      brandKeys.set(brandKey, brandName);
      locations.push({
        externalId,
        name: String(r.name ?? "").trim() || `${brandName} Location`,
        brandKey,
        brandName,
        address: String(r.address ?? "").trim(),
        city: String(r.city ?? "").trim(),
        state: String(r.state ?? "").trim(),
        zip: String(r.zip ?? "").trim(),
        lat,
        lng,
      });
    }

    if (!locations.length)
      return errorResponse("No valid locations after validation", 400);

    // ── 3. UPSERT BRANDS ────────────────────────────────
    // Fetch existing brands by normalized_name
    const allBrandKeys = Array.from(brandKeys.keys());
    const { data: existingBrands } = await db
      .from("brands")
      .select("id, normalized_name")
      .in("normalized_name", allBrandKeys);

    const brandIdMap = new Map<string, string>();
    for (const b of existingBrands ?? []) {
      brandIdMap.set(b.normalized_name, b.id);
    }

    // Insert missing brands
    const missingBrands = allBrandKeys.filter((k) => !brandIdMap.has(k));
    if (missingBrands.length) {
      const newBrands = missingBrands.map((key) => ({
        name: brandKeys.get(key)!,
        normalized_name: key,
        category,
        logo_emoji: "🍔",
      }));

      const { data: inserted, error: brandErr } = await db
        .from("brands")
        .insert(newBrands)
        .select("id, normalized_name");

      if (brandErr) {
        // Fallback: insert one by one for conflict handling
        for (const nb of newBrands) {
          const { data: single } = await db
            .from("brands")
            .insert(nb)
            .select("id, normalized_name")
            .single();
          if (single) brandIdMap.set(single.normalized_name, single.id);
        }
      } else {
        for (const b of inserted ?? []) {
          brandIdMap.set(b.normalized_name, b.id);
        }
      }
    }

    // ── 4. BULK INSERT LOCATIONS ────────────────────────
    const locationRows = locations
      .filter((l) => brandIdMap.has(l.brandKey))
      .map((l) => ({
        external_id: l.externalId,
        name: l.name,
        brand_id: brandIdMap.get(l.brandKey)!,
        address_line: l.address,
        city: l.city,
        state: l.state,
        zip_code: l.zip,
        country: "US",
        latitude: l.lat,
        longitude: l.lng,
      }));

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < locationRows.length; i += BATCH_SIZE) {
      const chunk = locationRows.slice(i, i + BATCH_SIZE);
      const { error: batchErr, count } = await db
        .from("brand_locations")
        .insert(chunk as any);

      if (batchErr) {
        // Batch failed — try individual inserts to skip duplicates
        for (const row of chunk) {
          const { error: singleErr } = await db
            .from("brand_locations")
            .insert(row as any);
          if (singleErr) {
            if (singleErr.message?.includes("duplicate") || singleErr.code === "23505") {
              skipped++;
            } else {
              skipped++;
              if (errors.length < 20) errors.push(singleErr.message);
            }
          } else {
            inserted++;
          }
        }
      } else {
        inserted += chunk.length;
      }
    }

    // ── 5. OPTIONAL MERGE (update existing rows) ────────
    let updated = 0;
    if (doMerge) {
      const externalIds = locationRows.map((r) => r.external_id);

      // Fetch existing in batches of 1000
      const existingLocs: Record<string, any>[] = [];
      for (let i = 0; i < externalIds.length; i += 1000) {
        const idChunk = externalIds.slice(i, i + 1000);
        const { data } = await db
          .from("brand_locations")
          .select("id, external_id, name, brand_id, address_line, city, state, zip_code, latitude, longitude")
          .in("external_id", idChunk);
        if (data) existingLocs.push(...data);
      }

      const existingMap = new Map(existingLocs.map((e) => [e.external_id, e]));

      const updates: { id: string; data: Record<string, unknown> }[] = [];
      for (const d of locationRows) {
        const e = existingMap.get(d.external_id);
        if (!e) continue;
        const changes: Record<string, unknown> = {};
        if (d.name && d.name !== e.name) changes.name = d.name;
        if (d.brand_id && d.brand_id !== e.brand_id) changes.brand_id = d.brand_id;
        if (d.address_line !== undefined && d.address_line !== e.address_line) changes.address_line = d.address_line;
        if (d.city !== undefined && d.city !== e.city) changes.city = d.city;
        if (d.state !== undefined && d.state !== e.state) changes.state = d.state;
        if (d.zip_code !== undefined && d.zip_code !== e.zip_code) changes.zip_code = d.zip_code;
        if (d.latitude !== undefined && d.latitude !== e.latitude) changes.latitude = d.latitude;
        if (d.longitude !== undefined && d.longitude !== e.longitude) changes.longitude = d.longitude;

        if (Object.keys(changes).length) updates.push({ id: e.id, data: changes });
      }

      for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
        const chunk = updates.slice(i, i + UPDATE_BATCH_SIZE);
        for (const u of chunk) {
          const { error: upErr } = await db
            .from("brand_locations")
            .update(u.data as any)
            .eq("id", u.id);
          if (!upErr) updated++;
        }
      }
    }

    return jsonResponse({
      status: "success",
      totalInputRows: rows.length,
      validLocations: locationRows.length,
      inserted,
      skipped,
      updated,
      brands: brandIdMap.size,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("BULK IMPORT ERROR:", err);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

// ── HELPERS ──────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(raw: string): Record<string, unknown>[] {
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => (row[h] = values[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}
