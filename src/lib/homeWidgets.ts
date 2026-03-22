// Home screen widget layout configuration

export interface HomeWidget {
  id: string;
  label: string;
  description: string;
  visible: boolean;
}

export const DEFAULT_WIDGETS: HomeWidget[] = [
  { id: "points", label: "In-app Points", description: "Your total points balance", visible: true },
  { id: "loyalty", label: "Loyalty Points", description: "Connected loyalty programs", visible: true },
  { id: "quickActions", label: "Quick Actions", description: "Scan, Rewards, Brands, History", visible: true },
  { id: "nearby", label: "Nearby Brands", description: "Closest brand locations to you", visible: true },
  { id: "favorites", label: "Favorite Brands", description: "Your favorited brand widgets", visible: true },
  { id: "activity", label: "Recent Activity", description: "Latest point transactions", visible: true },
];

const STORAGE_KEY = "home-widget-layout";

export function getWidgetLayout(): HomeWidget[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as HomeWidget[];
      const ids = new Set(parsed.map((w) => w.id));
      return [...parsed, ...DEFAULT_WIDGETS.filter((w) => !ids.has(w.id))];
    }
  } catch {}
  return DEFAULT_WIDGETS.map((w) => ({ ...w }));
}

export function saveWidgetLayout(widgets: HomeWidget[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}
