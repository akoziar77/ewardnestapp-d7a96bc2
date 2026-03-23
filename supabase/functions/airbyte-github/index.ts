import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AIRBYTE_API = "https://api.airbyte.com/v1";

async function getAirbyteToken(): Promise<string> {
  const clientId = Deno.env.get("AIRBYTE_CLIENT_ID");
  const clientSecret = Deno.env.get("AIRBYTE_CLIENT_SECRET");
  if (!clientId) throw new Error("AIRBYTE_CLIENT_ID is not configured");
  if (!clientSecret) throw new Error("AIRBYTE_CLIENT_SECRET is not configured");

  const res = await fetch("https://api.airbyte.com/v1/applications/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airbyte token request failed [${res.status}]: ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function airbyteRequest(
  token: string,
  path: string,
  method = "GET",
  body?: unknown
) {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${AIRBYTE_API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Airbyte API [${res.status}] ${path}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, params } = await req.json();
    const token = await getAirbyteToken();

    let result: unknown;

    switch (action) {
      case "list_sources":
        result = await airbyteRequest(token, "/sources");
        break;

      case "list_connections":
        result = await airbyteRequest(token, "/connections");
        break;

      case "create_source": {
        const { name, workspaceId, configuration } = params ?? {};
        result = await airbyteRequest(token, "/sources", "POST", {
          name,
          workspaceId,
          sourceType: "github",
          configuration: {
            ...configuration,
            sourceType: "github",
          },
        });
        break;
      }

      case "get_source": {
        result = await airbyteRequest(token, `/sources/${params.sourceId}`);
        break;
      }

      case "trigger_sync": {
        result = await airbyteRequest(
          token,
          `/connections/${params.connectionId}/jobs`,
          "POST",
          { jobType: "sync" }
        );
        break;
      }

      case "list_jobs": {
        const qs = params?.connectionId
          ? `?connectionId=${params.connectionId}`
          : "";
        result = await airbyteRequest(token, `/jobs${qs}`);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("airbyte-github error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
