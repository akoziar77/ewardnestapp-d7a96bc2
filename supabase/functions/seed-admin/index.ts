import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept x-admin-key, service_role via Authorization, or service_role via apikey header
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_API_KEY");
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isAdminKey = adminKey && adminKey === expectedKey;
    const isServiceRole = (authHeader && authHeader === `Bearer ${serviceRoleKey}`) ||
                          (apikeyHeader && apikeyHeader === serviceRoleKey);
    if (!isAdminKey && !isServiceRole) {
      console.log("Auth failed. Has x-admin-key:", !!adminKey, "Has auth:", !!authHeader, "Has apikey:", !!apikeyHeader);
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string | null = null;
    const body = await req.json().catch(() => ({}));
    const email = body?.email;

    if (email) {
      // Find user by email via auth admin API
      const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) throw listErr;
      const found = usersData.users.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (!found) {
        return new Response(
          JSON.stringify({ error: "User not found. They must sign up first." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = found.id;
    } else {
      // Promote caller from Authorization header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Provide email in body or Authorization header" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // Get admin role id
    const { data: roleData, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "admin")
      .single();
    if (roleErr || !roleData) throw new Error("Admin role not found");

    // Upsert user_role
    const { error: upsertErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role_id: roleData.id }, { onConflict: "user_id,role_id" });
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, role: "admin" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
