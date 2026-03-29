import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function ProfileArchived() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="relative flex items-center justify-center max-w-lg mx-auto">
          <button onClick={() => navigate("/profile")} className="absolute left-0 flex items-center gap-0.5 text-sm font-medium text-primary">
            <ChevronLeft className="h-5 w-5" /> Profile
          </button>
          <h1 className="text-base font-semibold text-foreground">Archived</h1>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center pt-40 px-8 text-center">
        <p className="text-sm text-muted-foreground max-w-[280px]">
          This section stores documents you want to keep but hide from the homescreen.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
