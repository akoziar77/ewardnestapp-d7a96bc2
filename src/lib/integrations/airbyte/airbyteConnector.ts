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

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** List all Airbyte sources */
export const airbyteListSources = () =>
  airbyteExec("sources", "sources", "list");

/** Get a single source by ID */
export const airbyteGetSource = (sourceId: string) =>
  airbyteExec("sources", "sources", "get", { sourceId });

/** Create a new GitHub source */
export const airbyteCreateGithubSource = (
  name: string,
  workspaceId: string,
  configuration: Record<string, unknown> = {}
) =>
  airbyteExec("github", "sources", "create", { name, workspaceId, configuration });

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/** List all connections */
export const airbyteListConnections = () =>
  airbyteExec("connections", "connections", "list");

/** Trigger a sync for a connection */
export const airbyteSyncConnection = (connectionId: string) =>
  airbyteExec("connections", "connections", "sync", { connectionId });

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** List jobs, optionally filtered by connection */
export const airbyteListJobs = (connectionId?: string) =>
  airbyteExec("jobs", "jobs", "list", connectionId ? { connectionId } : {});
