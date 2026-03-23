import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  requireFields,
  logInfo,
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

    const body = await req.json();
    requireFields(body, ["business_name"]);

    // Check if user already has a merchant
    const { data: existing } = await supabaseAdmin
      .from("merchant_users")
      .select("merchant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return errorResponse("User already has a merchant account", 409);
    }

    // Create merchant (service role bypasses RLS)
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .insert({ name: body.business_name.trim() })
      .select("id")
      .single();
    if (merchantError) throw merchantError;

    // Link user to merchant
    const { error: linkError } = await supabaseAdmin
      .from("merchant_users")
      .insert({
        user_id: user.id,
        merchant_id: merchant.id,
        role: "owner",
      });
    if (linkError) throw linkError;

    await logInfo(supabaseAdmin, "Merchant created via signup", {
      merchant_id: merchant.id,
      user_id: user.id,
    });

    return jsonResponse({ success: true, merchant_id: merchant.id });
  } catch (err) {
    console.error("merchant-signup error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
