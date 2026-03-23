import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Rocket,
  Building2,
  Users,
  Receipt,
  Gift,
  Megaphone,
  Workflow,
  Plug,
  BarChart3,
  ArrowLeft,
  Menu,
  X,
  Bell,
  Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/program-settings", icon: Rocket, label: "Program", end: false },
  { to: "/admin/brands", icon: Building2, label: "Brands", end: false },
  { to: "/admin/users", icon: Users, label: "Users", end: false },
  { to: "/admin/receipts", icon: Receipt, label: "Receipts", end: false },
  { to: "/admin/rewards", icon: Gift, label: "Rewards", end: false },
  { to: "/admin/campaigns", icon: Megaphone, label: "Campaigns", end: false },
  { to: "/admin/automations", icon: Workflow, label: "Automations", end: false },
  { to: "/admin/integrations", icon: Plug, label: "Integrations", end: false },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics", end: false },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentLabel =
    navItems.find(
      (n) =>
        n.end
          ? location.pathname === n.to
          : location.pathname.startsWith(n.to)
    )?.label ?? "Admin";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* ── Sidebar (desktop always, mobile overlay) ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rn-gold text-rn-primary font-bold text-sm">
            RN
          </div>
          <span className="text-lg font-bold tracking-wide text-sidebar-foreground">
            RewardsNest
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-rn-gold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <button
            onClick={() => {
              setMobileOpen(false);
              navigate("/home");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
          >
            <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
            <span>Back to App</span>
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted md:hidden active:scale-95 transition-transform"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-foreground md:text-lg">
              {currentLabel}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors active:scale-95">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors active:scale-95">
              <Bell className="h-[18px] w-[18px]" />
            </button>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-rn-gold text-xs font-bold text-rn-primary">
              {user?.email?.charAt(0).toUpperCase() ?? "A"}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
