import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { FileText, Image, ChevronLeft, Loader2 } from "lucide-react";
import type { DocTypeItem } from "./walletCategories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docType: DocTypeItem | null;
  onSaved: () => void;
}

type Step = "import" | "form";

export default function AddDocumentForm({ open, onOpenChange, docType, onSaved }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("import");
  const [title, setTitle] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("import");
    setTitle("");
    setCardNumber("");
    setExpiry("");
    setNotes("");
    setFrontFile(null);
    setFrontPreview(null);
  };

  const handleFileSelect = (file: File) => {
    setFrontFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFrontPreview(url);
    } else {
      setFrontPreview(null);
    }
    // Auto-set title from filename if empty
    if (!title) {
      const name = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setTitle(name);
    }
    setStep("form");
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("wallet-docs").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    return path;
  };

  const handleSave = async () => {
    if (!user || !docType || !title.trim()) return;
    setSaving(true);

    let frontPath: string | null = null;
    if (frontFile) {
      setUploading(true);
      frontPath = await uploadFile(frontFile);
      setUploading(false);
      if (!frontPath && frontFile) { setSaving(false); return; }
    }

    const { error } = await supabase.from("wallet_items").insert({
      user_id: user.id,
      category: docType.type,
      doc_type: docType.type,
      title: title.trim(),
      card_number: cardNumber.trim() || null,
      expiry_date: expiry.trim() || null,
      notes: notes.trim() || null,
      front_image_path: frontPath,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `${docType.label} added to your wallet.` });
      reset();
      onOpenChange(false);
      onSaved();
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl bg-card border-border overflow-y-auto pb-safe">
        {/* Hidden file inputs */}
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {step === "import" ? (
          <>
            {/* Import options — mimics Folio */}
            <SheetHeader className="mb-2">
              <button onClick={() => handleClose(false)} className="absolute left-4 top-4 text-sm font-medium text-primary">
                Cancel
              </button>
              <SheetTitle className="sr-only">Import</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col items-center pt-8 pb-6">
              <h2 className="text-xl font-bold text-foreground">{docType?.label}</h2>
              <p className="text-sm text-muted-foreground mt-2 text-center max-w-[280px]">
                Import a photo or PDF of your {docType?.label?.toLowerCase() || "document"} to store it securely.
              </p>
            </div>

            <div className="space-y-3 px-1 pb-8">
              {/* Import PDF */}
              <div className="rounded-2xl bg-muted/50 overflow-hidden">
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-[15px] font-medium text-primary">Import PDF</span>
                </button>
                <div className="h-px bg-border mx-4" />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <Image className="h-5 w-5 text-primary" />
                  <span className="text-[15px] font-medium text-primary">Choose Photo</span>
                </button>
              </div>

              {/* Skip — enter manually */}
              <div className="rounded-2xl bg-muted/50 overflow-hidden">
                <button
                  onClick={() => setStep("form")}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <span className="text-[15px] font-medium text-muted-foreground">Enter details manually</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Form step */}
            <SheetHeader className="mb-6">
              <button onClick={() => setStep("import")} className="absolute left-4 top-4 flex items-center gap-1 text-sm font-medium text-primary">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <SheetTitle className="text-center text-lg font-bold text-foreground">
                Add {docType?.label}
              </SheetTitle>
            </SheetHeader>

            {/* Preview of selected file */}
            {frontPreview && (
              <div className="mb-5 flex justify-center">
                <img src={frontPreview} alt="Preview" className="h-32 rounded-xl border border-border object-cover" />
              </div>
            )}
            {frontFile && !frontPreview && (
              <div className="mb-5 flex items-center gap-2 rounded-xl bg-muted/50 p-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm text-foreground truncate">{frontFile.name}</span>
              </div>
            )}

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
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading…</>
                ) : saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
