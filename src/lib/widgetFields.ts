// Widget field configuration for Home page brand widgets

export interface WidgetField {
  key: string;
  label: string;
  defaultVisible: boolean;
}

export const WIDGET_FIELDS: WidgetField[] = [
  { key: "progress", label: "Visit Progress", defaultVisible: true },
  { key: "milestonePoints", label: "Milestone Points", defaultVisible: true },
  { key: "externalPoints", label: "External Points", defaultVisible: true },
  { key: "expiringPoints", label: "Expiring Points", defaultVisible: true },
  { key: "category", label: "Category", defaultVisible: false },
  { key: "loyaltyProvider", label: "Loyalty Program", defaultVisible: false },
  { key: "visitExpiry", label: "Visit Expiry", defaultVisible: false },
  { key: "websiteLink", label: "Website Link", defaultVisible: false },
];

const STORAGE_KEY = "widget-visible-fields";

export function getVisibleWidgetFields(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return WIDGET_FIELDS.filter((f) => f.defaultVisible).map((f) => f.key);
}

export function setVisibleWidgetFields(keys: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function resetVisibleWidgetFields(): string[] {
  localStorage.removeItem(STORAGE_KEY);
  return WIDGET_FIELDS.filter((f) => f.defaultVisible).map((f) => f.key);
}
