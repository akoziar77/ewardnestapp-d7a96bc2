import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="relative flex items-center justify-center max-w-lg mx-auto">
          <button onClick={() => navigate("/profile")} className="absolute left-0 flex items-center gap-0.5 text-sm font-medium text-primary">
            <ChevronLeft className="h-5 w-5" /> Profile
          </button>
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Theme group */}
        <div className="rounded-2xl bg-muted/50 overflow-hidden divide-y divide-border/50">
          <button
            onClick={() => {
              const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
              setTheme(next);
            }}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted"
          >
            <span className="text-[15px] font-medium text-foreground">Theme</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {themeLabel} <ChevronsUpDown className="h-3.5 w-3.5" />
            </span>
          </button>
          <button className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted">
            <span className="text-[15px] font-medium text-foreground">Language</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              English <ChevronRight className="h-4 w-4" />
            </span>
          </button>
          <button onClick={() => navigate("/profile")} className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted">
            <span className="text-[15px] font-medium text-foreground">About</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
