import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeBlock } from "./CodeBlock";
import type { ReactNode } from "react";

interface Tab {
  label: string;
  language?: string;
  code: string;
}

interface CodeTabsProps {
  tabs: Tab[];
  title?: string;
}

export function CodeTabs({ tabs, title }: CodeTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <Tabs defaultValue={tabs[0].label} className="my-4">
      {title && (
        <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      )}
      <TabsList className="h-8 bg-muted/60">
        {tabs.map((t) => (
          <TabsTrigger key={t.label} value={t.label} className="text-xs px-3 py-1">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.label} value={t.label} className="mt-0">
          <CodeBlock code={t.code} language={t.language} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
