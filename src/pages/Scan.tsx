import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Check, X, Camera } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";

type ScanState =
  | { status: "scanning" }
  | { status: "processing" }
  | { status: "success"; merchantName: string; pointsEarned: number; newBalance: number }
  | { status: "error"; message: string };

export default function Scan() {
  const [state, setState] = useState<ScanState>({ status: "scanning" });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCheckin = useCallback(
    async (merchantId: string) => {
      if (processingRef.current || !user) return;
      processingRef.current = true;
      setState({ status: "processing" });

      // Stop scanner
      try {
        await scannerRef.current?.stop();
      } catch {}

      try {
        const { data, error } = await supabase.functions.invoke("scan-checkin", {
          body: { merchant_id: merchantId },
        });

        if (error) throw new Error(error.message || "Check-in failed");

        if (data?.error) {
          if (data.error === "already_checked_in") {
            setState({ status: "error", message: data.message || "Already checked in today." });
          } else if (data.error === "merchant_not_found") {
            setState({ status: "error", message: "This QR code isn't linked to a valid merchant." });
          } else {
            setState({ status: "error", message: data.message || "Something went wrong." });
          }
          return;
        }

        setState({
          status: "success",
          merchantName: data.merchant_name,
          pointsEarned: data.points_earned,
          newBalance: data.new_balance,
        });
      } catch (err: any) {
        setState({
          status: "error",
          message: err.message || "Failed to check in. Please try again.",
        });
      }
    },
    [user]
  );

  useEffect(() => {
    if (state.status !== "scanning") return;

    const scannerId = "qr-reader";
    let html5Qr: Html5Qrcode | null = null;

    const startScanner = async () => {
      html5Qr = new Html5Qrcode(scannerId);
      scannerRef.current = html5Qr;

      try {
        await html5Qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // QR format: rewardsnest://checkin/{merchant_id}
            const match = decodedText.match(
              /^rewardsnest:\/\/checkin\/([0-9a-f-]{36})$/
            );
            if (match) {
              handleCheckin(match[1]);
            } else {
              // Try plain UUID
              const uuidMatch = decodedText.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
              );
              if (uuidMatch) {
                handleCheckin(decodedText);
              }
            }
          },
          undefined
        );
      } catch (err) {
        console.error("Camera error:", err);
        setState({
          status: "error",
          message: "Could not access camera. Please grant camera permission.",
        });
      }
    };

    // Small delay so the DOM element is ready
    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      if (html5Qr?.isScanning) {
        html5Qr.stop().catch(() => {});
      }
    };
  }, [state.status, handleCheckin]);

  const goHome = () => navigate("/", { replace: true });

  const retry = () => {
    processingRef.current = false;
    setState({ status: "scanning" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={goHome}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">Scan QR Code</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {state.status === "scanning" && (
          <div className="w-full max-w-sm animate-in fade-in duration-300">
            <div className="relative mx-auto overflow-hidden rounded-3xl border-2 border-primary/20 bg-black">
              <div id="qr-reader" className="w-full" />
            </div>
            <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
              Align merchant QR inside the frame
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Point your camera at a merchant's QR code to check in and earn points.
            </p>

            {/* Manual code input */}
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground text-center">Or enter merchant code manually</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter merchant code"
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      const uuidMatch = val.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                      if (uuidMatch) handleCheckin(val);
                    }
                  }}
                  id="manual-merchant-code"
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById("manual-merchant-code") as HTMLInputElement;
                    const val = input?.value?.trim();
                    if (val) {
                      const uuidMatch = val.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                      if (uuidMatch) handleCheckin(val);
                      else setState({ status: "error", message: "Invalid merchant code format." });
                    }
                  }}
                  className="rounded-xl px-5"
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        )}

        {state.status === "processing" && (
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Processing check-in…</p>
          </div>
        )}

        {state.status === "success" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success))]">
                <Check className="h-8 w-8 text-[hsl(var(--success-foreground))]" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Check-in complete!</h2>
              <p className="mt-2 text-muted-foreground">{state.merchantName}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 w-full">
              <p className="text-sm text-muted-foreground">Points earned</p>
              <p className="text-4xl font-bold tracking-tight text-primary tabular-nums">
                +{state.pointsEarned}
              </p>
              <div className="mt-3 h-px bg-border" />
              <p className="mt-3 text-sm text-muted-foreground">
                New balance at {state.merchantName}
              </p>
              <p className="text-lg font-semibold tabular-nums">{state.newBalance} pts</p>
            </div>
            <Button
              onClick={goHome}
              className="h-14 w-full text-base font-semibold active:scale-[0.97] transition-transform"
            >
              Back to home
            </Button>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive">
                <X className="h-8 w-8 text-destructive-foreground" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Couldn't check in</h2>
              <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            </div>
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={goHome}
                className="h-12 flex-1 active:scale-[0.97] transition-transform"
              >
                Go back
              </Button>
              <Button
                onClick={retry}
                className="h-12 flex-1 active:scale-[0.97] transition-transform"
              >
                <Camera className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
