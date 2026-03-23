import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/utils.ts";

const MAX_ATTEMPTS = 5;

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

    // Validate caller
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

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── Dispatch webhooks for a specific event ──
      case "dispatch": {
        const { event_id } = body;
        if (!event_id) return errorResponse("event_id required", 400);

        // Fetch the event
        const { data: event } = await supabaseAdmin
          .from("event_log")
          .select("*")
          .eq("id", event_id)
          .maybeSingle();

        if (!event) return errorResponse("event not found", 404);

        // Find matching subscriptions
        const subQuery = supabaseAdmin
          .from("webhook_subscriptions")
          .select("id, url, secret, brand_id")
          .eq("event_type", event.event_type)
          .eq("is_active", true);

        const { data: subscriptions } = event.brand_id
          ? await subQuery.eq("brand_id", event.brand_id)
          : await subQuery;

        const results = [];
        for (const sub of subscriptions ?? []) {
          const result = await deliverWebhook(supabaseAdmin, sub, event);
          results.push(result);
        }

        return jsonResponse({
          event_id,
          dispatched: results.length,
          results,
        });
      }

      // ── Retry all failed deliveries in DLQ ──
      case "retry_dlq": {
        const limit = body.limit ?? 50;

        const { data: dlqItems } = await supabaseAdmin
          .from("dlq_events")
          .select("id, event_id, subscription_id, payload")
          .order("failed_at", { ascending: true })
          .limit(limit);

        const results = [];
        for (const item of dlqItems ?? []) {
          const { data: event } = await supabaseAdmin
            .from("event_log")
            .select("*")
            .eq("id", item.event_id)
            .maybeSingle();

          const { data: sub } = await supabaseAdmin
            .from("webhook_subscriptions")
            .select("id, url, secret, brand_id")
            .eq("id", item.subscription_id)
            .eq("is_active", true)
            .maybeSingle();

          if (!event || !sub) {
            results.push({
              dlq_id: item.id,
              status: "skipped",
              reason: !event ? "event_missing" : "subscription_inactive",
            });
            continue;
          }

          const result = await deliverWebhook(supabaseAdmin, sub, event);

          // Remove from DLQ if successful
          if (result.status === "success") {
            await supabaseAdmin.from("dlq_events").delete().eq("id", item.id);
          }

          results.push({ dlq_id: item.id, ...result });
        }

        return jsonResponse({ retried: results.length, results });
      }

      // ── List DLQ items ──
      case "list_dlq": {
        const { data: items } = await supabaseAdmin
          .from("dlq_events")
          .select(
            "id, event_id, subscription_id, error_message, failed_at, payload"
          )
          .order("failed_at", { ascending: false })
          .limit(body.limit ?? 100);

        return jsonResponse({ items: items ?? [] });
      }

      // ── Replay a specific event ──
      case "replay": {
        const { event_id } = body;
        if (!event_id) return errorResponse("event_id required", 400);

        // Mark replay
        await supabaseAdmin.from("event_replay_queue").insert({
          event_id,
          requested_by: user.id,
          processed: false,
        });

        // Fetch and re-dispatch
        const { data: event } = await supabaseAdmin
          .from("event_log")
          .select("*")
          .eq("id", event_id)
          .maybeSingle();

        if (!event) return errorResponse("event not found", 404);

        const { data: subscriptions } = await supabaseAdmin
          .from("webhook_subscriptions")
          .select("id, url, secret, brand_id")
          .eq("event_type", event.event_type)
          .eq("is_active", true);

        const results = [];
        for (const sub of subscriptions ?? []) {
          const result = await deliverWebhook(supabaseAdmin, sub, event);
          results.push(result);
        }

        // Mark replay as processed
        await supabaseAdmin
          .from("event_replay_queue")
          .update({ processed: true })
          .eq("event_id", event_id)
          .eq("requested_by", user.id)
          .eq("processed", false);

        return jsonResponse({
          event_id,
          replayed: true,
          dispatched: results.length,
          results,
        });
      }

      default:
        return errorResponse("invalid_action", 400, {
          valid_actions: ["dispatch", "retry_dlq", "list_dlq", "replay"],
        });
    }
  } catch (err) {
    console.error("event-dispatch error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});

// ── Deliver a webhook with retry + DLQ ──
async function deliverWebhook(
  supabaseAdmin: any,
  sub: { id: string; url: string; secret: string },
  event: any
) {
  const webhookPayload = {
    event_id: event.id,
    event_type: event.event_type,
    brand_id: event.brand_id,
    payload: event.payload,
    created_at: event.created_at,
  };

  // Count previous attempts
  const { count: prevAttempts } = await supabaseAdmin
    .from("webhook_delivery_log")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", sub.id)
    .eq("event_id", event.id);

  const attemptNumber = (prevAttempts ?? 0) + 1;

  // HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sub.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(JSON.stringify(webhookPayload))
  );
  const hexSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  let status = "pending";
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Event-Signature": hexSig,
        "X-Event-Type": event.event_type,
        "X-Event-Id": event.id,
      },
      body: JSON.stringify(webhookPayload),
    });

    responseStatus = res.status;
    responseBody = await res.text().catch(() => null);
    status = res.ok ? "success" : "failed";
  } catch (err) {
    status = "failed";
    errorMessage = String(err);
  }

  // Log delivery
  await supabaseAdmin.from("webhook_delivery_log").insert({
    subscription_id: sub.id,
    event_id: event.id,
    attempt_number: attemptNumber,
    status,
    response_status: responseStatus,
    response_body: responseBody?.slice(0, 2000),
    error_message: errorMessage,
  });

  // DLQ if max attempts exceeded
  if (status === "failed" && attemptNumber >= MAX_ATTEMPTS) {
    await supabaseAdmin.from("dlq_events").insert({
      event_id: event.id,
      subscription_id: sub.id,
      payload: event.payload,
      error_message: errorMessage || `HTTP ${responseStatus}`,
    });
  }

  return {
    subscription_id: sub.id,
    status,
    attempt: attemptNumber,
    response_status: responseStatus,
    moved_to_dlq: status === "failed" && attemptNumber >= MAX_ATTEMPTS,
  };
}
