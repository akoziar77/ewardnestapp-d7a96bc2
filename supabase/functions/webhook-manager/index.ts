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

    // Admin-only
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user.id)
      .limit(10);

    const isAdmin = adminRole?.some(
      (r: any) => (r as any).roles?.name === "admin"
    );
    if (!isAdmin) return errorResponse("forbidden", 403);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── List event types ──
      case "list_event_types": {
        const { data } = await supabaseAdmin
          .from("event_types")
          .select("*")
          .order("id");
        return jsonResponse({ event_types: data ?? [] });
      }

      // ── List webhook subscriptions ──
      case "list": {
        const { data } = await supabaseAdmin
          .from("webhook_subscriptions")
          .select("id, brand_id, event_type, url, is_active, created_at")
          .order("created_at", { ascending: false });
        return jsonResponse({ subscriptions: data ?? [] });
      }

      // ── Create or update subscription ──
      case "save": {
        const { subscription } = body;
        if (!subscription) return errorResponse("subscription required", 400);

        const { url, secret, event_type, brand_id, is_active, id } =
          subscription;

        if (!url || !secret || !event_type) {
          return errorResponse("url, secret, and event_type required", 400);
        }

        if (id) {
          // Update
          const { error } = await supabaseAdmin
            .from("webhook_subscriptions")
            .update({ url, secret, event_type, is_active: is_active ?? true })
            .eq("id", id);
          if (error) return errorResponse("update failed", 500);
          return jsonResponse({ success: true, id });
        } else {
          // Create
          if (!brand_id) return errorResponse("brand_id required", 400);
          const { data, error } = await supabaseAdmin
            .from("webhook_subscriptions")
            .insert({
              brand_id,
              url,
              secret,
              event_type,
              is_active: is_active ?? true,
            })
            .select("id")
            .single();
          if (error) return errorResponse("create failed", 500);
          return jsonResponse({ success: true, id: data.id });
        }
      }

      // ── Delete subscription ──
      case "delete": {
        const { subscription_id } = body;
        if (!subscription_id)
          return errorResponse("subscription_id required", 400);

        await supabaseAdmin
          .from("webhook_subscriptions")
          .delete()
          .eq("id", subscription_id);

        return jsonResponse({ success: true });
      }

      // ── Toggle active status ──
      case "toggle": {
        const { subscription_id, is_active } = body;
        if (!subscription_id)
          return errorResponse("subscription_id required", 400);

        await supabaseAdmin
          .from("webhook_subscriptions")
          .update({ is_active })
          .eq("id", subscription_id);

        return jsonResponse({ success: true });
      }

      // ── Delivery logs for a subscription ──
      case "delivery_logs": {
        const { subscription_id, limit: lim } = body;
        if (!subscription_id)
          return errorResponse("subscription_id required", 400);

        const { data } = await supabaseAdmin
          .from("webhook_delivery_log")
          .select("*")
          .eq("subscription_id", subscription_id)
          .order("created_at", { ascending: false })
          .limit(lim ?? 50);

        return jsonResponse({ logs: data ?? [] });
      }

      // ── Send a test event ──
      case "test": {
        const { subscription_id } = body;
        if (!subscription_id)
          return errorResponse("subscription_id required", 400);

        const { data: sub } = await supabaseAdmin
          .from("webhook_subscriptions")
          .select("*")
          .eq("id", subscription_id)
          .maybeSingle();

        if (!sub) return errorResponse("subscription not found", 404);

        const testPayload = {
          event_id: "test-" + crypto.randomUUID(),
          event_type: sub.event_type,
          brand_id: sub.brand_id,
          payload: { test: true, message: "Test webhook from RewardsNest" },
          created_at: new Date().toISOString(),
        };

        // HMAC sign
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
          encoder.encode(JSON.stringify(testPayload))
        );
        const hexSig = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        let status = "success";
        let responseStatus: number | null = null;
        let responseBody: string | null = null;
        let errorMessage: string | null = null;

        try {
          const res = await fetch(sub.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Event-Signature": hexSig,
              "X-Event-Type": sub.event_type,
              "X-Event-Id": testPayload.event_id,
            },
            body: JSON.stringify(testPayload),
          });
          responseStatus = res.status;
          responseBody = await res.text().catch(() => null);
          status = res.ok ? "success" : "failed";
        } catch (err) {
          status = "failed";
          errorMessage = String(err);
        }

        return jsonResponse({
          test: true,
          status,
          response_status: responseStatus,
          response_body: responseBody?.slice(0, 500),
          error_message: errorMessage,
        });
      }

      default:
        return errorResponse("invalid_action", 400, {
          valid_actions: [
            "list_event_types",
            "list",
            "save",
            "delete",
            "toggle",
            "delivery_logs",
            "test",
          ],
        });
    }
  } catch (err) {
    console.error("webhook-manager error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
