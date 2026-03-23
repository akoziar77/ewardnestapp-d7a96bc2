import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate caller via token
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

    // ── Parse body ──
    const body = await req.json();
    const { event_type, source, actor_id, brand_id, payload } = body;

    if (!event_type || !payload) {
      return errorResponse("missing event_type or payload", 400);
    }

    // Validate event_type exists
    const { data: validType } = await supabaseAdmin
      .from("event_types")
      .select("event_key")
      .eq("event_key", event_type)
      .maybeSingle();

    if (!validType) {
      return errorResponse("unknown event_type", 400, { event_type });
    }

    // ── Insert into event_log ──
    const { data: event, error: insertErr } = await supabaseAdmin
      .from("event_log")
      .insert({
        event_type,
        source: source || "system",
        actor_id: actor_id || user.id,
        brand_id: brand_id || null,
        payload,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Event log insert error:", insertErr);
      return errorResponse("failed to log event", 500);
    }

    // ── Broadcast via Supabase Realtime channel ──
    const channel = supabaseAdmin.channel("event-bus");
    await channel.send({
      type: "broadcast",
      event: event_type,
      payload: {
        event_id: event.id,
        event_type,
        brand_id,
        actor_id: actor_id || user.id,
        payload,
        created_at: event.created_at,
      },
    });
    supabaseAdmin.removeChannel(channel);

    // ── Fan-out: find matching webhook subscriptions and log deliveries ──
    const { data: subscriptions } = await supabaseAdmin
      .from("webhook_subscriptions")
      .select("id, url, secret")
      .eq("event_type", event_type)
      .eq("is_active", true)
      .or(brand_id ? `brand_id.eq.${brand_id}` : "brand_id.is.null");

    const deliveryResults: Array<{
      subscription_id: string;
      status: string;
      response_status?: number;
    }> = [];

    for (const sub of subscriptions ?? []) {
      // Build HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(sub.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(JSON.stringify(payload))
      );
      const hexSig = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      let deliveryStatus = "pending";
      let responseStatus: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;

      try {
        const res = await fetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Event-Signature": hexSig,
            "X-Event-Type": event_type,
            "X-Event-Id": event.id,
          },
          body: JSON.stringify({
            event_id: event.id,
            event_type,
            brand_id,
            payload,
            created_at: event.created_at,
          }),
        });

        responseStatus = res.status;
        responseBody = await res.text().catch(() => null);
        deliveryStatus = res.ok ? "success" : "failed";
      } catch (err) {
        deliveryStatus = "failed";
        errorMessage = String(err);
      }

      // Log delivery attempt
      await supabaseAdmin.from("webhook_delivery_log").insert({
        subscription_id: sub.id,
        event_id: event.id,
        attempt_number: 1,
        status: deliveryStatus,
        response_status: responseStatus,
        response_body: responseBody?.slice(0, 2000),
        error_message: errorMessage,
      });

      // If failed, add to DLQ
      if (deliveryStatus === "failed") {
        await supabaseAdmin.from("dlq_events").insert({
          event_id: event.id,
          subscription_id: sub.id,
          payload,
          error_message: errorMessage || `HTTP ${responseStatus}`,
        });
      }

      deliveryResults.push({
        subscription_id: sub.id,
        status: deliveryStatus,
        response_status: responseStatus ?? undefined,
      });
    }

    return jsonResponse({
      success: true,
      event_id: event.id,
      webhooks_dispatched: deliveryResults.length,
      deliveries: deliveryResults,
    });
  } catch (err) {
    console.error("event-ingest error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
