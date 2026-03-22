import { useLocation, useNavigate } from "react-router-dom";
import { Home, QrCode, Gift, History, Rocket } from "lucide-react";

const items = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: QrCode, label: "Scan", path: "/scan" },
  { icon: Rocket, label: "Engage+", path: "/engage" },
  { icon: Gift, label: "Rewards", path: "/rewards" },
  { icon: History, label: "History", path: "/history" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {items.map(({ icon: Icon, label, path }) => {
          const active = pathname === path || (path === "/home" && pathname === "/");
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors active:scale-[0.94] ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
