import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  logInfo,
  logWarn,
  calculateBasePoints,
  updateTierProgression,
  getActiveBoosters,
} from "../_shared/utils.ts";
import { applyBoosters } from "../_shared/booster-engine.ts";

// ── Constants ──
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const REVIEW_AMOUNT_THRESHOLD = 500; // flag receipts over $500
const MAX_RETRIES = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", 401);

    const userId = user.id;

    // ── Parse form ──
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const retryReceiptId = form.get("retry_receipt_id") as string | null;
    if (!file) return errorResponse("missing file", 400);

    const fileExt = file.name.split(".").pop() ?? "jpg";
    const storagePath = `receipts/${userId}/${crypto.randomUUID()}.${fileExt}`;

    // ── Upload to storage ──
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("receipts")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      await logStep(supabaseAdmin, retryReceiptId, "upload_failed", String(uploadErr));
      return errorResponse("upload_failed", 500, { details: String(uploadErr) });
    }

    // ── OCR via Lovable AI (with retry) ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return errorResponse("AI key not configured", 500);
    }

    const arrayBuf = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuf).reduce((s, b) => s + String.fromCharCode(b), "")
    );
    const mimeType = file.type || "image/jpeg";

    let parsed = await extractWithOCR(LOVABLE_API_KEY, base64, mimeType);
    let retryCount = 0;

    // Retry if confidence is very low
    if (parsed.confidence !== null && parsed.confidence < 0.3 && retryCount < MAX_RETRIES) {
      await logStep(supabaseAdmin, null, "ocr_retry", `Low confidence ${parsed.confidence}, retrying`);
      parsed = await extractWithOCR(LOVABLE_API_KEY, base64, mimeType);
      retryCount++;
    }

    // ── Merchant normalization ──
    const normalizedMerchant = normalizeMerchantName(parsed.merchant);

    // ── Brand matching ──
    const brandId = await matchBrand(supabaseAdmin, normalizedMerchant, parsed.merchant);

    // ── Admin review flag ──
    const adminReviewFlag = shouldFlagForReview(parsed, brandId);

    // ── Insert or update receipt record ──
    let receiptId: string;

    if (retryReceiptId) {
      // Retry: update existing record
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("receipt_uploads")
        .update({
          file_path: storagePath,
          ocr_text: parsed.raw_text,
          merchant_name: parsed.merchant,
          normalized_merchant: normalizedMerchant,
          total_amount: parsed.total,
          purchase_date: parsed.date,
          confidence: parsed.confidence,
          admin_review_flag: adminReviewFlag,
          retry_count: retryCount + 1,
          status: adminReviewFlag ? "pending" : "pending",
        })
        .eq("id", retryReceiptId)
        .eq("user_id", userId)
        .select("id")
        .single();

      if (updateErr) {
        console.error("Receipt update error:", updateErr);
        return errorResponse("db_update_failed", 500);
      }
      receiptId = updated.id;
    } else {
      // New receipt
      const { data: receipt, error: receiptErr } = await supabaseAdmin
        .from("receipt_uploads")
        .insert({
          user_id: userId,
          brand_id: brandId,
          file_path: storagePath,
          ocr_text: parsed.raw_text,
          merchant_name: parsed.merchant,
          normalized_merchant: normalizedMerchant,
          total_amount: parsed.total,
          purchase_date: parsed.date,
          confidence: parsed.confidence,
          admin_review_flag: adminReviewFlag,
          retry_count: retryCount,
          status: "pending",
        })
        .select()
        .single();

      if (receiptErr) {
        console.error("Receipt insert error:", receiptErr);
        return errorResponse("db_insert_failed", 500);
      }
      receiptId = receipt.id;
    }

    // ── Insert line items with SKU + category ──
    if (parsed.items && parsed.items.length > 0) {
      // Delete old line items on retry
      if (retryReceiptId) {
        await supabaseAdmin
          .from("receipt_line_items")
          .delete()
          .eq("receipt_id", receiptId);
      }

      const lineItems = parsed.items.map((i) => ({
        receipt_id: receiptId,
        item_name: i.name,
        quantity: i.qty,
        price: i.price,
        sku: i.sku ?? null,
        category: i.category ?? null,
      }));
      await supabaseAdmin.from("receipt_line_items").insert(lineItems);
    }

    // ── Processing log ──
    await logStep(supabaseAdmin, receiptId, "completed", "Receipt processed successfully", {
      confidence: parsed.confidence,
      items_count: parsed.items?.length ?? 0,
      brand_matched: !!brandId,
      admin_flagged: adminReviewFlag,
      retry_count: retryCount,
    });

    // ── Points awarding (with booster hooks) ──
    let pointsAwarded = 0;
    let boosterBonus = 0;

    if (brandId && parsed.total && parsed.total > 0 && !adminReviewFlag) {
      try {
        const basePoints = await calculateBasePoints(
          supabaseAdmin,
          parsed.total,
          brandId
        );

        // Apply boosters (including SKU-level if items have categories)
        const boosterResult = await applyBoosters({
          client: supabaseAdmin,
          user_id: userId,
          brand_id: brandId,
          amount: parsed.total,
          action_type: "receipt_scan",
        });

        pointsAwarded = basePoints + (boosterResult.totalBonusPoints ?? 0);
        boosterBonus = boosterResult.totalBonusPoints ?? 0;

        // Update tier progression
        await updateTierProgression(supabaseAdmin, userId, brandId, parsed.total);

        // Update profile nest_points
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("nest_points")
          .eq("user_id", userId)
          .single();

        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({
              nest_points: (profile.nest_points ?? 0) + pointsAwarded,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }

        // Insert transaction
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          brand_id: brandId,
          amount: parsed.total,
          points_earned: pointsAwarded,
          source: "receipt",
        });

        await logInfo(supabaseAdmin, "Receipt points awarded", {
          user_id: userId,
          brand_id: brandId,
          points: pointsAwarded,
          booster_bonus: boosterBonus,
          receipt_id: receiptId,
        });
      } catch (e) {
        console.error("Points awarding error:", e);
        await logStep(supabaseAdmin, receiptId, "points_error", String(e));
      }
    } else if (adminReviewFlag) {
      await logStep(
        supabaseAdmin,
        receiptId,
        "points_deferred",
        "Points deferred pending admin review"
      );
    }

    return jsonResponse({
      success: true,
      receipt_id: receiptId,
      brand_id: brandId,
      points_awarded: pointsAwarded,
      booster_bonus: boosterBonus,
      admin_review_flag: adminReviewFlag,
      parsed: {
        merchant: parsed.merchant,
        normalized_merchant: normalizedMerchant,
        total: parsed.total,
        date: parsed.date,
        confidence: parsed.confidence,
        items_count: parsed.items?.length ?? 0,
      },
    });
  } catch (err) {
    console.error("receipt-upload error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});

// ── OCR extraction via Lovable AI ──
async function extractWithOCR(
  apiKey: string,
  base64: string,
  mimeType: string
): Promise<ParsedReceipt> {
  const aiResponse = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a receipt OCR parser. Extract data from the receipt image. Be thorough with line items — include SKU codes if visible and categorize items (e.g. "grocery", "beverage", "household", "electronics"). Return ONLY the structured data via the tool call.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
              { type: "text", text: "Extract all data from this receipt including individual line items with SKUs if visible." },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_receipt",
              description: "Return structured receipt data with line items",
              parameters: {
                type: "object",
                properties: {
                  merchant: { type: "string", description: "Store/restaurant name exactly as printed" },
                  total: { type: "number", description: "Total amount paid" },
                  date: { type: "string", description: "Purchase date in ISO 8601 format" },
                  confidence: { type: "number", description: "0.0-1.0 confidence score" },
                  raw_text: { type: "string", description: "Full OCR text of receipt" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        qty: { type: "number" },
                        price: { type: "number" },
                        sku: { type: "string", description: "SKU or product code if visible" },
                        category: {
                          type: "string",
                          enum: ["grocery", "beverage", "household", "electronics", "clothing", "health", "food", "other"],
                          description: "Item category",
                        },
                      },
                      required: ["name", "qty", "price"],
                    },
                  },
                },
                required: ["merchant", "total", "date", "confidence", "raw_text", "items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_receipt" } },
      }),
    }
  );

  if (!aiResponse.ok) {
    const status = aiResponse.status;
    console.error("AI gateway error:", status);
    if (status === 429) throw new Error("rate_limited");
    if (status === 402) throw new Error("credits_exhausted");
    throw new Error("ocr_failed");
  }

  const aiData = await aiResponse.json();

  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    return JSON.parse(toolCall.function.arguments);
  } catch {
    try {
      const content = aiData.choices?.[0]?.message?.content ?? "";
      return JSON.parse(content.replace(/```json\n?|```/g, "").trim());
    } catch {
      return {
        merchant: null,
        total: null,
        date: null,
        confidence: 0,
        raw_text: null,
        items: [],
      };
    }
  }
}

// ── Merchant name normalization ──
function normalizeMerchantName(name: string | null): string | null {
  if (!name) return null;

  let normalized = name.trim();

  // Remove common suffixes
  const suffixes = [
    /\s*(inc\.?|llc\.?|ltd\.?|co\.?|corp\.?|store\s*#?\d*|location\s*#?\d*)$/i,
  ];
  for (const re of suffixes) {
    normalized = normalized.replace(re, "").trim();
  }

  // Remove store numbers like "#1234"
  normalized = normalized.replace(/\s*#\d+\s*$/, "").trim();

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ");

  // Title case
  normalized = normalized
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return normalized;
}

// ── Admin review flag logic ──
function shouldFlagForReview(
  parsed: ParsedReceipt,
  brandId: string | null
): boolean {
  // Low confidence
  if (
    parsed.confidence !== null &&
    parsed.confidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    return true;
  }

  // High amount
  if (parsed.total !== null && parsed.total > REVIEW_AMOUNT_THRESHOLD) {
    return true;
  }

  // No brand matched
  if (!brandId && parsed.merchant) {
    return true;
  }

  // Missing critical fields
  if (!parsed.total || !parsed.merchant) {
    return true;
  }

  return false;
}

// ── Brand matching: exact → alias → normalized → fuzzy ──
async function matchBrand(
  supabase: ReturnType<typeof createClient>,
  normalizedMerchant: string | null,
  originalMerchant: string | null
): Promise<string | null> {
  const names = [normalizedMerchant, originalMerchant].filter(Boolean) as string[];
  if (names.length === 0) return null;

  for (const name of names) {
    const lower = name.toLowerCase();

    // 1. Exact match
    const { data: exact } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", lower)
      .limit(1)
      .maybeSingle();
    if (exact) return exact.id;

    // 2. Alias match
    const { data: alias } = await supabase
      .from("brand_aliases")
      .select("brand_id")
      .ilike("alias", lower)
      .limit(1)
      .maybeSingle();
    if (alias) return alias.brand_id;
  }

  // 3. Fuzzy substring match
  const { data: allBrands } = await supabase.from("brands").select("id, name");
  if (allBrands) {
    const target = (normalizedMerchant ?? originalMerchant ?? "").toLowerCase();
    for (const brand of allBrands) {
      const bl = brand.name.toLowerCase();
      if (target.includes(bl) || bl.includes(target)) {
        return brand.id;
      }
    }
  }

  return null;
}

// ── Logging helper ──
async function logStep(
  supabase: ReturnType<typeof createClient>,
  receiptId: string | null,
  step: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  if (!receiptId) return;
  try {
    await supabase.from("receipt_processing_logs").insert({
      receipt_id: receiptId,
      step,
      message,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.error("Log step error:", e);
  }
}

// ── Types ──
interface ParsedReceipt {
  merchant: string | null;
  total: number | null;
  date: string | null;
  confidence: number | null;
  raw_text: string | null;
  items: {
    name: string;
    qty: number;
    price: number;
    sku?: string;
    category?: string;
  }[];
}
