import { CreditCard, FileBox, Trash2 } from "lucide-react";
import { getDocType } from "./walletCategories";

// We import the same icon map used in the sheet
import { Plane, Car, Globe, FileText, Gift, ShoppingBag, Users, Cross, Shield, Baby, Heart, Smartphone, KeyRound } from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Plane, Car, Globe, CreditCard, FileText, Gift, ShoppingBag, Users, Cross, Shield, Baby, Heart, Smartphone, KeyRound, FileBox,
};

interface Props {
  item: {
    id: string;
    doc_type: string;
    title: string;
    card_number?: string | null;
    expiry_date?: string | null;
  };
  onDelete: (id: string) => void;
}

export default function WalletItemCard({ item, onDelete }: Props) {
  const dt = getDocType(item.doc_type);
  const Icon = dt ? ICON_MAP[dt.icon] || FileBox : FileBox;
  const color = dt?.color || "bg-gray-500";

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-4 transition-all hover:bg-muted">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color} text-white`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {dt?.label || item.doc_type}
          {item.card_number && ` · ${item.card_number.slice(-4).padStart(item.card_number.length, '•')}`}
          {item.expiry_date && ` · ${item.expiry_date}`}
        </p>
      </div>
      <button onClick={() => onDelete(item.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
