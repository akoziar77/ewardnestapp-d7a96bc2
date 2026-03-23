import { NavLink, Outlet } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocsSearchTrigger } from "./components/DocsSearch";
import { VersionSwitcher } from "./components/VersionSwitcher";

const links = [
  { title: "Introduction", href: "/docs", end: true },
  { title: "Webhooks", href: "/docs/webhooks" },
  { title: "Events", href: "/docs/events" },
  { title: "Authentication", href: "/docs/auth" },
  { title: "API Keys", href: "/docs/api-keys" },
  { title: "SDKs", href: "/docs/sdk-node" },
  { title: "Testing Tools", href: "/docs/testing" },
  { title: "Changelog", href: "/docs/changelog" },
];

export default function DocsLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center h-14 px-4 gap-4">
          <NavLink to="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm">
            <ChevronLeft className="h-4 w-4" />
            App
          </NavLink>
          <div className="h-5 w-px bg-border" />
          <span className="font-semibold text-foreground tracking-tight">RewardsNest Developer Portal</span>
          <div className="ml-auto flex items-center gap-2">
            <VersionSwitcher />
            <DocsSearchTrigger />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 h-[calc(100vh-3.5rem)] border-r border-border bg-muted/30 p-6 sticky top-14">
          <nav className="space-y-1">
            {links.map((l) => (
              <NavLink
                key={l.href}
                to={l.href}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "text-primary font-medium bg-primary/10"
                      : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                  )
                }
              >
                {l.title}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden border-b border-border overflow-x-auto">
          <div className="flex gap-1 px-4 py-2">
            {links.map((l) => (
              <NavLink
                key={l.href}
                to={l.href}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )
                }
              >
                {l.title}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10">
          <div className="max-w-3xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}