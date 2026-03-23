import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMyRoles(supabase: SupabaseClient, userId?: string): Promise<string[]> {
  let uid = userId;
  if (!uid) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    } catch {
      return [];
    }
  }
  if (!uid) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id, roles(name)")
    .eq("user_id", uid);

  if (error || !data) return [];

  return data.map((r: any) => r.roles?.name).filter(Boolean);
}
