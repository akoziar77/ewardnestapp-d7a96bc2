import { useOutletContext } from "react-router-dom";
import { QrCode, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type Ctx = { merchantId: string; merchantName: string };

export default function MerchantQR() {
  const { merchantId, merchantName } = useOutletContext<Ctx>();
  const [copied, setCopied] = useState(false);

  const qrValue = `rewardsnest://checkin/${merchantId}`;
  // Use a QR code API for display
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}&margin=16`;

  const copyValue = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">QR Code</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Print this code and display it at your counter for customer check-ins
        </p>
      </div>

      <div className="mx-auto max-w-sm">
        <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-6">
          {/* QR image */}
          <div className="mx-auto w-[250px] h-[250px] rounded-2xl overflow-hidden border border-border bg-white p-2">
            <img
              src={qrImageUrl}
              alt={`QR code for ${merchantName}`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>

          <div>
            <h2 className="text-lg font-bold">{merchantName}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Scan to earn {50} points
            </p>
          </div>

          {/* QR value */}
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">QR payload</p>
            <code className="text-xs break-all">{qrValue}</code>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={copyValue}
              className="flex-1 h-11 active:scale-[0.97]"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </>
              )}
            </Button>
            <Button
              onClick={() => window.open(qrImageUrl, "_blank")}
              className="flex-1 h-11 active:scale-[0.97]"
            >
              <QrCode className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
