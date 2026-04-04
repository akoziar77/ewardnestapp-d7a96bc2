import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export default function CustomerQRDialog({ open, onOpenChange, userId }: Props) {
  const qrValue = `customer:${userId}`;

  const copyId = () => {
    navigator.clipboard.writeText(qrValue);
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>Your QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5 py-4">
          <div className="rounded-2xl border border-border bg-white p-5">
            <QRCodeSVG value={qrValue} size={260} level="M" />
          </div>
          <p className="text-sm text-muted-foreground">
            Show this QR to the cashier to earn or redeem points.
          </p>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={copyId}>
              <Copy className="h-4 w-4 mr-2" />
              Copy ID
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
