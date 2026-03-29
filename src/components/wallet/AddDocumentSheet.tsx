import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronRight, Plane, Car, Globe, CreditCard, FileText, Gift, ShoppingBag, Users, Cross, Shield, Baby, Heart, Smartphone, KeyRound, FileBox } from "lucide-react";
import { WALLET_CATEGORIES, type DocTypeItem } from "./walletCategories";

const ICON_MAP: Record<string, React.ElementType> = {
  Plane, Car, Globe, CreditCard, FileText, Gift, ShoppingBag, Users, Cross, Shield, Baby, Heart, Smartphone, KeyRound, FileBox,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (item: DocTypeItem) => void;
}

export default function AddDocumentSheet({ open, onOpenChange, onSelect }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-card border-border overflow-y-auto pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-center text-lg font-bold text-foreground">Add</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          {WALLET_CATEGORIES.map((cat) => (
            <div key={cat.label} className="rounded-2xl bg-muted/50 overflow-hidden">
              {cat.items.map((item, idx) => {
                const Icon = ICON_MAP[item.icon] || FileBox;
                return (
                  <button
                    key={item.type}
                    onClick={() => onSelect(item)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-[15px] font-medium text-foreground">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
