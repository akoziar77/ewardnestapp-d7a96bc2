import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { DocTypeItem } from "./walletCategories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docType: DocTypeItem | null;
  onSaved: () => void;
}

export default function AddDocumentForm({ open, onOpenChange, docType, onSaved }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !docType || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("wallet_items").insert({
      user_id: user.id,
      category: docType.type,
      doc_type: docType.type,
      title: title.trim(),
      card_number: cardNumber.trim() || null,
      expiry_date: expiry.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `${docType.label} added to your wallet.` });
      setTitle(""); setCardNumber(""); setExpiry(""); setNotes("");
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl bg-card border-border overflow-y-auto pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-center text-lg font-bold text-foreground">
            Add {docType?.label}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-1 pb-8">
          <div className="space-y-2">
            <Label>Title / Name</Label>
            <Input placeholder={`e.g. My ${docType?.label || "Card"}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Card / Document Number</Label>
            <Input placeholder="Optional" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Input placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Any extra details…" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button className="w-full" size="lg" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
