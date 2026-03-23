import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent, entity, action, params } = await req.json();

    if (!agent) {
      return new Response(JSON.stringify({ error: "Missing agent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const AIRBYTE_CLIENT_ID = Deno.env.get("AIRBYTE_CLIENT_ID")!;
    const AIRBYTE_CLIENT_SECRET = Deno.env.get("AIRBYTE_CLIENT_SECRET")!;
    const AIRBYTE_EXTERNAL_USER_ID = Deno.env.get("AIRBYTE_EXTERNAL_USER_ID")!;

    const url = `https://api.airbyte.com/v1/agents/${agent}/execute`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-airbyte-client-id": AIRBYTE_CLIENT_ID,
        "x-airbyte-client-secret": AIRBYTE_CLIENT_SECRET,
        "x-airbyte-external-user-id": AIRBYTE_EXTERNAL_USER_ID,
      },
      body: JSON.stringify({ entity, action, params }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.ok ? 200 : response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Airbyte exec failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
