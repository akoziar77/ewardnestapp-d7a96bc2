import { supabase } from "@/integrations/supabase/client";

/**
 * Unified Airbyte connector — calls the airbyte-exec edge function.
 *
 * @param agent   - Airbyte agent name (e.g. "github", "sources", "connections", "jobs")
 * @param entity  - Entity type (e.g. "sources", "connections")
 * @param action  - Action to perform (e.g. "list", "create", "sync")
 * @param params  - Additional parameters for the request
 */
export async function airbyteExec(
  agent: string,
  entity: string | null = null,
  action: string | null = null,
  params: Record<string, unknown> = {}
) {
  const { data, error } = await supabase.functions.invoke("airbyte-exec", {
    body: { agent, entity, action, params },
  });

  if (error) throw new Error(error.message || "Airbyte exec failed");
  return data;
}
