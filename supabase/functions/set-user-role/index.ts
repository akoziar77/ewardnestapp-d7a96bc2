import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin using service role client
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);

    const isCallerAdmin = callerRoles?.some((r: any) => r.roles?.name === "admin");
    if (!isCallerAdmin) {
      return new Response(JSON.stringify({ error: "forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, user_id: targetUserId, role: roleName, email } = await req.json();

    if (!action || !roleName || (!targetUserId && !email)) {
      return new Response(
        JSON.stringify({ error: "action, role, and (user_id or email) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve user_id from email if needed
    let resolvedUserId = targetUserId;
    if (!resolvedUserId && email) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const found = usersData?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (!found) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedUserId = found.id;
    }

    // Get role id
    const { data: roleData, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();
    if (roleErr || !roleData) {
      return new Response(JSON.stringify({ error: `Role '${roleName}' not found` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assign") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: resolvedUserId, role_id: roleData.id },
          { onConflict: "user_id,role_id" }
        );
      if (error) throw error;
    } else if (action === "remove") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", resolvedUserId)
        .eq("role_id", roleData.id);
      if (error) throw error;
    } else {
      return new Response(JSON.stringify({ error: "action must be 'assign' or 'remove'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
