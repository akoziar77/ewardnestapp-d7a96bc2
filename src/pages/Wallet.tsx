import { useEffect, useState, useCallback } from "react";
import { Plus, Wallet as WalletIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import AddDocumentSheet from "@/components/wallet/AddDocumentSheet";
import AddDocumentForm from "@/components/wallet/AddDocumentForm";
import WalletItemCard from "@/components/wallet/WalletItemCard";
import type { DocTypeItem } from "@/components/wallet/walletCategories";

export default function Wallet() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<DocTypeItem | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("wallet_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSelectType = (item: DocTypeItem) => {
    setSelectedType(item);
    setShowAdd(false);
    setTimeout(() => setShowForm(true), 200);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("wallet_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Deleted" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-foreground">Wallet</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mb-5">
              <WalletIcon className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Your wallet is empty</h2>
            <p className="text-sm text-muted-foreground max-w-[260px]">
              Store your cards, IDs, tickets, and documents all in one place. Tap "Add" to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <WalletItemCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <AddDocumentSheet open={showAdd} onOpenChange={setShowAdd} onSelect={handleSelectType} />
      <AddDocumentForm open={showForm} onOpenChange={setShowForm} docType={selectedType} onSaved={fetchItems} />
      <BottomNav />
    </div>
  );
}
