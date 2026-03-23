import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AIRBYTE_API = "https://api.airbyte.com/v1";

/** Mirrors AirbyteAuthConfig from the Python/Node SDK */
interface AirbyteAuthConfig {
  external_user_id: string;
  airbyte_client_id: string;
  airbyte_client_secret: string;
}

function loadAuthConfig(): AirbyteAuthConfig {
  const clientId = Deno.env.get("AIRBYTE_CLIENT_ID");
  const clientSecret = Deno.env.get("AIRBYTE_CLIENT_SECRET");
  if (!clientId) throw new Error("AIRBYTE_CLIENT_ID is not configured");
  if (!clientSecret) throw new Error("AIRBYTE_CLIENT_SECRET is not configured");

  return {
    external_user_id: Deno.env.get("AIRBYTE_EXTERNAL_USER_ID") ?? "",
    airbyte_client_id: clientId,
    airbyte_client_secret: clientSecret,
  };
}

async function getToken(config: AirbyteAuthConfig): Promise<string> {
  const res = await fetch(`${AIRBYTE_API}/applications/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.airbyte_client_id,
      client_secret: config.airbyte_client_secret,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airbyte token request failed [${res.status}]: ${body}`);
  }
  return (await res.json()).access_token;
}

async function airbyteRequest(token: string, path: string, method = "GET", body?: unknown) {
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
    throw new Error(`Airbyte API [${res.status}] ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Mirrors connector.execute(entity, action, params) from airbyte-agent-github SDK.
 *
 * Supported entity.action combos:
 *   sources.list, sources.create, sources.get
 *   connections.list, connections.sync
 *   jobs.list
 */
async function execute(
  token: string,
  entity: string,
  action: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const key = `${entity}.${action}`;

  switch (key) {
    case "sources.list":
      return airbyteRequest(token, "/sources");
    case "sources.create":
      return airbyteRequest(token, "/sources", "POST", {
        name: params.name,
        workspaceId: params.workspaceId,
        sourceType: "github",
        configuration: { ...(params.configuration as object ?? {}), sourceType: "github" },
      });
    case "sources.get":
      return airbyteRequest(token, `/sources/${params.sourceId}`);
    case "connections.list":
      return airbyteRequest(token, "/connections");
    case "connections.sync":
      return airbyteRequest(token, `/connections/${params.connectionId}/jobs`, "POST", { jobType: "sync" });
    case "jobs.list": {
      const qs = params.connectionId ? `?connectionId=${params.connectionId}` : "";
      return airbyteRequest(token, `/jobs${qs}`);
    }
    default:
      throw new Error(`Unsupported operation: ${key}`);
  }
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { entity, action, params } = await req.json();
    const config = loadAuthConfig();
    const token = await getToken(config);
    const result = await execute(token, entity, action, params ?? {});

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
