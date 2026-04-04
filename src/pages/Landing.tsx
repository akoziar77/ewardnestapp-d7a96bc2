import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QrCode, Gift, Smartphone, ArrowRight, CheckCircle } from "lucide-react";

const steps = [
  { title: "Install Wallet", desc: "Customers install RewardNest and create a profile.", icon: Smartphone },
  { title: "Scan QR", desc: "Scan or show QR at checkout to earn points.", icon: QrCode },
  { title: "Redeem", desc: "Redeem rewards instantly at checkout.", icon: Gift },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 md:py-32 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            The Universal Loyalty Wallet for Local Businesses
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Earn points at every local shop. Redeem instantly. No hardware required.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-base font-semibold" onClick={() => navigate("/pricing")}>
              Start Free Pilot
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold" onClick={() => navigate("/auth")}>
              See Demo
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 bg-muted/30">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
          <p className="mt-3 text-muted-foreground">Three simple steps to loyalty freedom.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshots */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">See It in Action</h2>
          <p className="mt-3 text-muted-foreground">Built for speed, designed for delight.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            { label: "Customer Wallet", desc: "Points, rewards, and QR — all in one place." },
            { label: "Merchant Dashboard", desc: "Track visits, award points, manage rewards." },
            { label: "QR Flow", desc: "Scan or show — earning points takes seconds." },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-muted/30 p-8">
              <div className="flex h-40 w-full items-center justify-center rounded-xl bg-muted">
                <span className="text-4xl">📱</span>
              </div>
              <h3 className="text-base font-bold">{item.label}</h3>
              <p className="text-sm text-muted-foreground text-center">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">Plans start at $0</h2>
          <p className="mt-3 text-muted-foreground">Pilot offers available for early adopters.</p>
          <Button className="mt-8 h-12 px-8" variant="outline" onClick={() => navigate("/pricing")}>
            View Pricing
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} RewardNest. All rights reserved.
      </footer>
    </div>
  );
}
