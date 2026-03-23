import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Webhook,
  Send,
  Trash2,
  Save,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

async function callWebhookManager(
  action: string,
  extra?: Record<string, unknown>
) {
  const { data, error } = await supabase.functions.invoke("webhook-manager", {
    body: { action, ...extra },
  });
  if (error) throw error;
  return data;
}

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  success: { variant: "default", icon: CheckCircle2 },
  failed: { variant: "destructive", icon: XCircle },
  pending: { variant: "secondary", icon: Clock },
  retrying: { variant: "outline", icon: Activity },
  dead: { variant: "destructive", icon: XCircle },
};

export default function AdminWebhooks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    url: "",
    secret: "",
    event_type: "receipt.uploaded",
    brand_id: "",
    is_active: true,
    id: null as string | null,
  });

  // ── Queries ──
  const subsQ = useQuery({
    queryKey: ["webhook-subs"],
    queryFn: () => callWebhookManager("list"),
  });

  const typesQ = useQuery({
    queryKey: ["event-types"],
    queryFn: () => callWebhookManager("list_event_types"),
  });

  const logsQ = useQuery({
    queryKey: ["webhook-logs", selectedId],
    queryFn: () =>
      callWebhookManager("delivery_logs", { subscription_id: selectedId }),
    enabled: !!selectedId,
  });

  const brandsQ = useQuery({
    queryKey: ["brands-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");
      return data ?? [];
    },
  });

  const subscriptions = subsQ.data?.subscriptions ?? [];
  const eventTypes = typesQ.data?.event_types ?? [];
  const logs = logsQ.data?.logs ?? [];
  const brands = brandsQ.data ?? [];

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: () => callWebhookManager("save", { subscription: form }),
    onSuccess: () => {
      toast.success("Webhook saved");
      queryClient.invalidateQueries({ queryKey: ["webhook-subs"] });
      setIsCreating(false);
      setSelectedId(null);
    },
    onError: () => toast.error("Failed to save webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      callWebhookManager("delete", { subscription_id: id }),
    onSuccess: () => {
      toast.success("Webhook deleted");
      queryClient.invalidateQueries({ queryKey: ["webhook-subs"] });
      setSelectedId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => callWebhookManager("toggle", { subscription_id: id, is_active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["webhook-subs"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      callWebhookManager("test", { subscription_id: id }),
    onSuccess: (data) => {
      if (data.status === "success") {
        toast.success(`Test delivered — HTTP ${data.response_status}`);
      } else {
        toast.error(
          `Test failed — ${data.error_message || `HTTP ${data.response_status}`}`
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["webhook-logs", selectedId],
      });
    },
  });

  // ── Handlers ──
  function selectSub(sub: any) {
    setIsCreating(false);
    setSelectedId(sub.id);
    setForm({
      id: sub.id,
      url: sub.url ?? "",
      secret: "",
      event_type: sub.event_type,
      brand_id: sub.brand_id ?? "",
      is_active: sub.is_active,
    });
  }

  function startCreate() {
    setSelectedId(null);
    setIsCreating(true);
    setForm({
      id: null,
      url: "",
      secret: "",
      event_type: eventTypes[0]?.event_key ?? "receipt.uploaded",
      brand_id: brands[0]?.id ?? "",
      is_active: true,
    });
  }

  const showEditor = isCreating || selectedId;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Webhook Manager</h1>
          <p className="text-sm text-muted-foreground">
            Manage event subscriptions &amp; delivery
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 flex flex-col md:flex-row gap-6">
        {/* ── Left: Subscription List ── */}
        <div className="md:w-[340px] shrink-0 space-y-3">
          <Button onClick={startCreate} className="w-full gap-2">
            <Plus className="h-4 w-4" /> New Webhook
          </Button>

          {subsQ.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : subscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Webhook className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No webhooks configured
              </CardContent>
            </Card>
          ) : (
            subscriptions.map((sub: any) => (
              <Card
                key={sub.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  selectedId === sub.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => selectSub(sub)}
              >
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {sub.event_type}
                    </Badge>
                    <Switch
                      checked={sub.is_active}
                      onCheckedChange={(checked) => {
                        toggleMutation.mutate({
                          id: sub.id,
                          is_active: checked,
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <p className="text-sm text-foreground font-mono truncate">
                    {sub.url}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── Right: Editor + Logs ── */}
        <div className="flex-1 space-y-6">
          {!showEditor ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Select a webhook or create a new one
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {isCreating ? "Create Webhook" : "Edit Webhook"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Event Type</Label>
                      <Select
                        value={form.event_type}
                        onValueChange={(v) =>
                          setForm({ ...form, event_type: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {eventTypes.map((t: any) => (
                            <SelectItem
                              key={t.event_key}
                              value={t.event_key}
                            >
                              {t.event_key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {isCreating && (
                      <div className="space-y-2">
                        <Label>Brand</Label>
                        <Select
                          value={form.brand_id}
                          onValueChange={(v) =>
                            setForm({ ...form, brand_id: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Endpoint URL</Label>
                    <Input
                      value={form.url}
                      onChange={(e) =>
                        setForm({ ...form, url: e.target.value })
                      }
                      placeholder="https://example.com/webhook"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Signing Secret{" "}
                      {selectedId && (
                        <span className="text-muted-foreground font-normal">
                          (leave blank to keep current)
                        </span>
                      )}
                    </Label>
                    <Input
                      type="password"
                      value={form.secret}
                      onChange={(e) =>
                        setForm({ ...form, secret: e.target.value })
                      }
                      placeholder="whsec_…"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, is_active: checked })
                      }
                    />
                    <Label>Active</Label>
                  </div>

                  <Separator />

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saveMutation.isPending ? "Saving…" : "Save"}
                    </Button>

                    {selectedId && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => testMutation.mutate(selectedId)}
                          disabled={testMutation.isPending}
                          className="gap-2"
                        >
                          <Send className="h-4 w-4" />
                          {testMutation.isPending ? "Sending…" : "Send Test"}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(selectedId)}
                          disabled={deleteMutation.isPending}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Logs */}
              {selectedId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Delivery Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {logsQ.isLoading ? (
                      <div className="p-6 space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : logs.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No deliveries yet
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Attempt</TableHead>
                            <TableHead>HTTP</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((l: any) => {
                            const cfg = STATUS_BADGE[l.status] ??
                              STATUS_BADGE.pending;
                            const Icon = cfg.icon;
                            return (
                              <TableRow key={l.id}>
                                <TableCell>
                                  <Badge
                                    variant={cfg.variant}
                                    className="gap-1"
                                  >
                                    <Icon className="h-3 w-3" />
                                    {l.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="tabular-nums">
                                  #{l.attempt_number}
                                </TableCell>
                                <TableCell className="tabular-nums">
                                  {l.response_status ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(l.created_at).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
