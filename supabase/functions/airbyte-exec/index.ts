import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AIRBYTE_API = "https://api.airbyte.com/v1";

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${AIRBYTE_API}/applications/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airbyte token request failed [${res.status}]: ${body}`);
  }
  return (await res.json()).access_token;
}

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

    const token = await getToken(AIRBYTE_CLIENT_ID, AIRBYTE_CLIENT_SECRET);

    const url = `${AIRBYTE_API}/agents/${agent}/execute`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
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
