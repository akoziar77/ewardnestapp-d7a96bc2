import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMyRoles(supabase: SupabaseClient): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id, roles(name)")
    .eq("user_id", user.id);

  if (error || !data) return [];

  return data.map((r: any) => r.roles?.name).filter(Boolean);
}
