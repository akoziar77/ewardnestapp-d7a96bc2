import { supabase } from "@/integrations/supabase/client";

/**
 * Executes a GitHub action through the Airbyte connector edge function.
 *
 * Mirrors the airbyte-agent-github SDK interface:
 *   connector.execute(entity, action, params)
 *
 * @param entity - GitHub entity (e.g., "sources", "connections", "jobs")
 * @param action - Action to perform (e.g., "list", "get", "create", "sync")
 * @param params - Additional parameters for the action
 *
 * @example
 *   await githubExec("sources", "list", {});
 *   await githubExec("connections", "sync", { connectionId: "..." });
 *   await githubExec("jobs", "list", { connectionId: "..." });
 */
export async function githubExec(
  entity: string,
  action: string,
  params: Record<string, unknown> = {}
) {
  const { data, error } = await supabase.functions.invoke("airbyte-github", {
    body: { entity, action, params },
  });

  if (error) throw new Error(error.message ?? "GitHub connector execution failed");
  if (!data?.success) throw new Error(data?.error ?? "GitHub connector execution failed");
  return data.data;
}
