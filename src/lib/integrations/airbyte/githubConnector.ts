import { supabase } from "@/integrations/supabase/client";

export type AirbyteAction =
  | "list_sources"
  | "list_connections"
  | "create_source"
  | "get_source"
  | "trigger_sync"
  | "list_jobs";

/** Low-level call mapped to a fixed Airbyte action. */
export async function airbyteGithub(action: AirbyteAction, params?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("airbyte-github", {
    body: { action, params },
  });

  if (error) throw new Error(error.message ?? "Airbyte request failed");
  if (!data.success) throw new Error(data.error ?? "Airbyte request failed");
  return data.data;
}

/**
 * Mirror of the Python SDK's `connector.execute(entity, action, params)`.
 *
 * Examples:
 *   githubExec("sources",     "list",    {})
 *   githubExec("connections", "list",    {})
 *   githubExec("connections", "sync",    { connectionId: "..." })
 *   githubExec("sources",     "create",  { name: "...", workspaceId: "...", configuration: {...} })
 *   githubExec("sources",     "get",     { sourceId: "..." })
 *   githubExec("jobs",        "list",    { connectionId: "..." })
 */
export async function githubExec(
  entity: string,
  action: string,
  params: Record<string, unknown> = {}
) {
  const actionMap: Record<string, AirbyteAction> = {
    "sources.list": "list_sources",
    "sources.create": "create_source",
    "sources.get": "get_source",
    "connections.list": "list_connections",
    "connections.sync": "trigger_sync",
    "jobs.list": "list_jobs",
  };

  const key = `${entity}.${action}`;
  const mapped = actionMap[key];
  if (!mapped) throw new Error(`Unsupported operation: ${key}`);

  return airbyteGithub(mapped, params);
}
