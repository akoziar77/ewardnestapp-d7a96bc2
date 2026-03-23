import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Settings,
  Store,
  Users,
  Receipt,
  Gift,
  Megaphone,
  Workflow,
  Plug,
  BarChart3,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/program-settings", icon: Settings, label: "Program Settings", end: false },
  { to: "/admin/brands", icon: Store, label: "Brands", end: false },
  { to: "/admin/users", icon: Users, label: "Users", end: false },
  { to: "/admin/receipts", icon: Receipt, label: "Receipts", end: false },
  { to: "/admin/rewards", icon: Gift, label: "Rewards", end: false },
  { to: "/admin/campaigns", icon: Megaphone, label: "Campaigns", end: false },
  { to: "/admin/automations", icon: Workflow, label: "Automations", end: false },
  { to: "/admin/integrations", icon: Plug, label: "Integrations", end: false },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics", end: false },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col border-r border-border bg-card transition-[width] duration-200",
          collapsed ? "md:w-[68px]" : "md:w-60"
        )}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-border">
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight truncate">
              Admin Panel
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-95"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2"
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-border space-y-0.5">
          <button
            onClick={() => navigate("/home")}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              collapsed && "justify-center px-2"
            )}
          >
            <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Back to App</span>}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border bg-card/95 backdrop-blur-sm overflow-x-auto">
        {navItems.slice(0, 5).map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors min-w-[64px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
