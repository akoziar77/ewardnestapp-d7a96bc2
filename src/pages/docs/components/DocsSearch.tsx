import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const docsIndex = [
  { title: "Introduction", path: "/docs", group: "Getting Started" },
  { title: "Authentication", path: "/docs/auth", group: "Guides" },
  { title: "API Keys", path: "/docs/api-keys", group: "Guides" },
  { title: "Webhooks", path: "/docs/webhooks", group: "Guides" },
  { title: "Events", path: "/docs/events", group: "Guides" },
  { title: "Node SDK", path: "/docs/sdk-node", group: "SDKs" },
  { title: "Testing Tools", path: "/docs/testing", group: "Tools" },
  { title: "Changelog", path: "/docs/changelog", group: "Other" },
];

export function DocsSearchTrigger() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate]
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof docsIndex>();
    docsIndex.forEach((item) => {
      const arr = map.get(item.group) || [];
      arr.push(item);
      map.set(item.group, arr);
    });
    return map;
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground font-normal"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search docs…</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search documentation…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Array.from(groups.entries()).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.path}
                  value={item.title}
                  onSelect={() => handleSelect(item.path)}
                >
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
