import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

/**
 * IMPORT BRANDS FROM OPENSTREETMAP OVERPASS API
 *
 * Tiles a bounding box, queries Overpass for each brand in DB,
 * and bulk-inserts locations with external_id dedup + optional merge.
 *
 * Body:
 *   minLat, minLon, maxLat, maxLon (required)
 *   tilesPerSide (default 4)
 *   pauseMsBetweenTiles (default 800)
 *   pauseMsBetweenBrands (default 1200)
 *   excludeCategories: string[] (categories to skip)
 *   poiTags: [{key,value}] (default amenity=fast_food + restaurant)
 *   doMerge (default true)
 *   category: string (filter brands by category, e.g. "Fast Food")
 *
 * Auth: admin only (JWT or x-admin-key)
 */

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const INSERT_BATCH = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH ──
    const authHeader = req.headers.get("authorization") ?? "";
    const adminKey = req.headers.get("x-admin-key") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const storedAdminKey = Deno.env.get("ADMIN_API_KEY") ?? "";

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
      minLat, minLon, maxLat, maxLon,
      tilesPerSide = 4,
      pauseMsBetweenTiles = 800,
      pauseMsBetweenBrands = 1200,
      excludeCategories = [] as string[],
      poiTags = [
        { key: "amenity", value: "fast_food" },
        { key: "amenity", value: "restaurant" },
        { key: "amenity", value: "cafe" },
      ],
      doMerge = true,
      category,
    } = body;

    if (minLat == null || minLon == null || maxLat == null || maxLon == null) {
      return errorResponse("Provide minLat, minLon, maxLat, maxLon", 400);
    }

    // ── 1. LOAD BRANDS ──
    let brandQuery = db.from("brands").select("id, name, normalized_name, category");
    if (category) brandQuery = brandQuery.eq("category", category);
    const { data: allBrands } = await brandQuery;

    const brands = (allBrands ?? []).filter(
      (b: any) => !excludeCategories.includes(b.category)
    );

    if (!brands.length) return errorResponse("No brands found to import", 400);

    // ── 2. TILE BBOX ──
    const tiles = tileBBox(minLat, minLon, maxLat, maxLon, tilesPerSide);

    // ── 3. QUERY OVERPASS PER BRAND ──
    const allRows: Record<string, unknown>[] = [];
    const seenExtIds = new Set<string>();

    for (const brand of brands) {
      const brandName = brand.name.replace(/"/g, '\\"');
      const brandKey = normalize(brand.name);

      for (const tile of tiles) {
        const query = buildOverpassQuery(tile, brandName, poiTags);

        try {
          const resp = await withRetry(() =>
            fetch(OVERPASS_URL, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `data=${encodeURIComponent(query)}`,
            })
          );

          if (!resp.ok) {
            console.warn(`Overpass ${resp.status} for ${brand.name}`);
            await sleep(pauseMsBetweenTiles);
            continue;
          }

          const json = await resp.json();
          for (const el of json.elements ?? []) {
            const loc = elementToLocation(el, brand.name);
            if (!loc) continue;

            const extId = loc.externalId;
            if (seenExtIds.has(extId)) continue;
            seenExtIds.add(extId);

            allRows.push({
              external_id: extId,
              brand_id: brand.id,
              name: loc.name,
              address_line: loc.address || "",
              city: loc.city || "",
              state: loc.state || "",
              zip_code: loc.zip || "",
              country: "US",
              latitude: loc.lat,
              longitude: loc.lng,
            });
          }
        } catch (err) {
          console.warn(`Overpass error for ${brand.name}:`, err);
        }

        await sleep(pauseMsBetweenTiles);
      }

      await sleep(pauseMsBetweenBrands);
    }

    if (!allRows.length) {
      return jsonResponse({ status: "no_data", brandsProcessed: brands.length, locations: 0 });
    }

    // ── 4. BULK INSERT ──
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < allRows.length; i += INSERT_BATCH) {
      const chunk = allRows.slice(i, i + INSERT_BATCH);
      const { error: batchErr } = await db.from("brand_locations").insert(chunk as any);

      if (batchErr) {
        for (const row of chunk) {
          const { error: singleErr } = await db.from("brand_locations").insert(row as any);
          if (singleErr) {
            skipped++;
            if (singleErr.code === "23505" || singleErr.message?.includes("duplicate")) continue;
            if (errors.length < 20) errors.push(singleErr.message);
          } else {
            inserted++;
          }
        }
      } else {
        inserted += chunk.length;
      }
    }

    // ── 5. OPTIONAL MERGE ──
    let updated = 0;
    if (doMerge) {
      const extIds = allRows.map((r) => r.external_id as string);
      const existingLocs: any[] = [];

      for (let i = 0; i < extIds.length; i += 1000) {
        const { data } = await db
          .from("brand_locations")
          .select("id, external_id, name, brand_id, address_line, city, state, zip_code, latitude, longitude")
          .in("external_id", extIds.slice(i, i + 1000));
        if (data) existingLocs.push(...data);
      }

      const existingMap = new Map(existingLocs.map((e: any) => [e.external_id, e]));

      for (const row of allRows) {
        const e = existingMap.get(row.external_id as string);
        if (!e) continue;
        const changes: Record<string, unknown> = {};
        if (row.name && row.name !== e.name) changes.name = row.name;
        if (row.brand_id && row.brand_id !== e.brand_id) changes.brand_id = row.brand_id;
        if (row.address_line !== undefined && row.address_line !== e.address_line) changes.address_line = row.address_line;
        if (row.city !== undefined && row.city !== e.city) changes.city = row.city;
        if (row.state !== undefined && row.state !== e.state) changes.state = row.state;
        if (row.zip_code !== undefined && row.zip_code !== e.zip_code) changes.zip_code = row.zip_code;
        if (row.latitude !== undefined && row.latitude !== e.latitude) changes.latitude = row.latitude;
        if (row.longitude !== undefined && row.longitude !== e.longitude) changes.longitude = row.longitude;

        if (Object.keys(changes).length) {
          const { error: upErr } = await db.from("brand_locations").update(changes as any).eq("id", e.id);
          if (!upErr) updated++;
        }
      }
    }

    return jsonResponse({
      status: "success",
      brandsProcessed: brands.length,
      totalLocationsSeen: allRows.length,
      inserted,
      skipped,
      updated,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("IMPORT OVERPASS ERROR:", err);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

// ── HELPERS ──────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const retriable = !err?.status || err?.status === 429 || (err?.status >= 500);
      if (!retriable) throw err;
      await sleep(baseDelay * Math.pow(2, i));
    }
  }
  throw lastErr;
}

type BBox = { minLat: number; minLon: number; maxLat: number; maxLon: number };

function tileBBox(minLat: number, minLon: number, maxLat: number, maxLon: number, n = 4): BBox[] {
  const latStep = (maxLat - minLat) / n;
  const lonStep = (maxLon - minLon) / n;
  const tiles: BBox[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      tiles.push({
        minLat: minLat + i * latStep,
        minLon: minLon + j * lonStep,
        maxLat: minLat + (i + 1) * latStep,
        maxLon: minLon + (j + 1) * lonStep,
      });
    }
  }
  return tiles;
}

function buildOverpassQuery(bbox: BBox, brandName: string, poiTags: { key: string; value: string }[]): string {
  const box = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
  const parts: string[] = [];

  for (const tag of poiTags) {
    for (const type of ["node", "way", "relation"]) {
      parts.push(`${type}["brand"="${brandName}"]["${tag.key}"="${tag.value}"](${box});`);
      parts.push(`${type}["operator"="${brandName}"]["${tag.key}"="${tag.value}"](${box});`);
    }
  }

  return `[out:json][timeout:60];(${parts.join("\n")});out center tags;`;
}

function elementToLocation(el: any, brandRaw: string) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;
  if (lat == null || lon == null) return null;

  const brand = tags.brand || tags.operator || brandRaw;
  const name = tags.name || brand;
  const addressParts = [tags["addr:housenumber"] || "", tags["addr:street"] || ""].filter(Boolean);

  return {
    externalId: `osm-${el.id}`,
    name: name.trim(),
    address: addressParts.join(" ").trim() || null,
    city: tags["addr:city"] || tags["addr:place"] || null,
    state: tags["addr:state"] || null,
    zip: tags["addr:postcode"] || null,
    lat: Number(lat),
    lng: Number(lon),
  };
}
