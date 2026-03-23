import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AdminBrands() {
  const { data: brands, isLoading } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, logo_emoji, category, created_at")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage partner brands in your loyalty network.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {brands?.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <span className="text-2xl">{b.logo_emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.name}</p>
                  {b.category && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {b.category}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {brands?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">No brands yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
