import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Camera, Search } from "lucide-react";

export default function MerchantScan() {
  const navigate = useNavigate();
  const { merchantId } = useOutletContext<{ merchantId: string }>();
  const [manualId, setManualId] = useState("");
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  const handleCustomerFound = useCallback(
    (customerId: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      try { scannerRef.current?.stop(); } catch {}
      navigate(`/merchant/award?customer=${encodeURIComponent(customerId)}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (!scanning) return;
    const scannerId = "merchant-qr-reader";
    let html5Qr: Html5Qrcode | null = null;

    const start = async () => {
      html5Qr = new Html5Qrcode(scannerId);
      scannerRef.current = html5Qr;
      try {
        await html5Qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            const match = decoded.match(/^customer:(.+)$/);
            if (match) handleCustomerFound(match[1]);
            const uuidMatch = decoded.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            if (uuidMatch) handleCustomerFound(decoded);
          },
          undefined
        );
      } catch {
        setError("Could not access camera. Please grant permission.");
        setScanning(false);
      }
    };

    const timer = setTimeout(start, 100);
    return () => {
      clearTimeout(timer);
      if (html5Qr?.isScanning) html5Qr.stop().catch(() => {});
    };
  }, [scanning, handleCustomerFound]);

  const handleManualLookup = async () => {
    if (!manualId.trim()) return;
    setError("");
    // Try looking up by user_id or phone in profiles
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .or(`user_id.eq.${manualId.trim()},phone.eq.${manualId.trim()}`)
      .limit(1)
      .maybeSingle();

    if (data) {
      handleCustomerFound(data.user_id);
    } else {
      setError("Customer not found. Check the ID or phone number.");
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan Customer</h1>
        <p className="text-sm text-muted-foreground">Scan a customer's QR code or enter their ID manually.</p>
      </div>

      {scanning && (
        <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-black">
          <div id="merchant-qr-reader" className="w-full" />
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Or enter customer ID / phone</p>
        <div className="flex gap-2">
          <Input
            placeholder="Customer ID or phone"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
          />
          <Button onClick={handleManualLookup}>
            <Search className="h-4 w-4 mr-2" />
            Lookup
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  );
}
