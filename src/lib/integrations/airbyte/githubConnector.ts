import { supabase } from "@/integrations/supabase/client";

export type AirbyteAction =
  | "list_sources"
  | "list_connections"
  | "create_source"
  | "get_source"
  | "trigger_sync"
  | "list_jobs";

export async function airbyteGithub(action: AirbyteAction, params?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("airbyte-github", {
    body: { action, params },
  });

  if (error) throw new Error(error.message ?? "Airbyte request failed");
  if (!data.success) throw new Error(data.error ?? "Airbyte request failed");
  return data.data;
}
