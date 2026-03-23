import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, Github, RefreshCw, Play, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { airbyteGithub } from "@/lib/integrations/airbyte/githubConnector";
import { toast } from "sonner";

interface AirbyteConnection {
  connectionId: string;
  name: string;
  status: string;
  sourceId?: string;
  destinationId?: string;
}

interface AirbyteJob {
  jobId: number;
  status: string;
  jobType: string;
  startTime?: string;
  connectionId?: string;
}

export default function AdminIntegrations() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: connections, isLoading: loadingConns, error: connError } = useQuery({
    queryKey: ["airbyte-connections"],
    queryFn: () => airbyteGithub("list_connections"),
    retry: 1,
  });

  const { data: jobs, isLoading: loadingJobs } = useQuery({
    queryKey: ["airbyte-jobs"],
    queryFn: () => airbyteGithub("list_jobs"),
    retry: 1,
  });

  const triggerSync = useMutation({
    mutationFn: (connectionId: string) =>
      airbyteGithub("trigger_sync", { connectionId }),
    onSuccess: () => {
      toast.success("Sync triggered successfully");
      queryClient.invalidateQueries({ queryKey: ["airbyte-jobs"] });
      setSyncingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setSyncingId(null);
    },
  });

  const connectionList: AirbyteConnection[] = connections?.data ?? [];
  const jobList: AirbyteJob[] = jobs?.data ?? [];

  const statusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "succeeded":
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "failed":
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const noData = !loadingConns && connectionList.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage Airbyte GitHub data syncs.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["airbyte-connections"] });
            queryClient.invalidateQueries({ queryKey: ["airbyte-jobs"] });
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {connError && (
        <Card>
          <CardContent className="py-10 text-center">
            <XCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
            <p className="font-medium">Unable to reach Airbyte</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {(connError as Error).message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!connError && noData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Plug className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No Airbyte connections found</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Create a GitHub source and connection in your Airbyte workspace, then refresh this page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Connections */}
      {connectionList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Github className="h-5 w-5" />
              Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {connectionList.map((c) => (
              <div
                key={c.connectionId}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(c.status)}
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {c.connectionId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {c.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={triggerSync.isPending}
                    onClick={() => {
                      setSyncingId(c.connectionId);
                      triggerSync.mutate(c.connectionId);
                    }}
                  >
                    {syncingId === c.connectionId && triggerSync.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-4 w-4" />
                    )}
                    Sync
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      {jobList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobList.slice(0, 10).map((j) => (
                <div
                  key={j.jobId}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(j.status)}
                    <span className="font-mono text-xs">#{j.jobId}</span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {j.jobType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {j.status}
                    </Badge>
                    {j.startTime && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(j.startTime).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {(loadingConns || loadingJobs) && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
