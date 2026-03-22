// Unified API field registry — single source of truth for Brand page & Home widget
import { format } from "date-fns";

export interface BrandData {
  id: string;
  name: string;
  logo_emoji: string;
  category: string | null;
  milestone_visits: number;
  milestone_points: number;
  visit_expiry_months: number;
  website_url: string | null;
  loyalty_api_url: string | null;
  loyalty_provider: string | null;
  api_field_name: string | null;
}

export interface BrandVisitData {
  id: string;
  brand_id: string;
  notes: string | null;
  created_at: string;
}

export interface FieldContext {
  brand: BrandData;
  conn: any;
  profile: any;
  visits: BrandVisitData[];
  expiringPts: number;
}

export interface LoyaltyFieldDef {
  key: string;
  label: string;
  apiName: string;
  section: string;
  defaultVisible: boolean;
  getValue: (ctx: FieldContext) => React.ReactNode;
}

export const LOYALTY_API_FIELDS: LoyaltyFieldDef[] = [
  // 1. Member Profile
  { key: "member_id", section: "Member Profile", label: "Member ID", apiName: "member_id", defaultVisible: false, getValue: ({ conn }) => conn?.id ?? null },
  { key: "external_member_id", section: "Member Profile", label: "External Member ID", apiName: "external_member_id", defaultVisible: false, getValue: ({ conn }) => conn?.external_member_id ?? null },
  { key: "display_name", section: "Member Profile", label: "Display Name", apiName: "display_name", defaultVisible: false, getValue: ({ profile }) => profile?.display_name ?? null },

  // 2. Account & Program
  { key: "category", section: "Account & Program", label: "Category", apiName: "category", defaultVisible: false, getValue: ({ brand }) => brand.category },
  { key: "loyaltyProvider", section: "Account & Program", label: "Loyalty Program", apiName: "loyalty_provider", defaultVisible: false, getValue: ({ brand }) => brand.loyalty_provider },
  { key: "provider_name", section: "Account & Program", label: "Provider Name", apiName: "provider_name", defaultVisible: false, getValue: ({ conn }) => conn?.provider_name ?? null },
  { key: "connection_status", section: "Account & Program", label: "Connection Status", apiName: "status", defaultVisible: false, getValue: ({ conn }) => conn?.status ?? null },
  { key: "api_field_name", section: "Account & Program", label: "API Field Name", apiName: "api_field_name", defaultVisible: false, getValue: ({ brand }) => brand.api_field_name },

  // 3. Points & Balance
  { key: "milestonePoints", section: "Points & Balance", label: "Milestone Points", apiName: "milestone_points", defaultVisible: true, getValue: ({ brand }) => brand.milestone_points },
  { key: "externalPoints", section: "Points & Balance", label: "External Points", apiName: "external_points_balance", defaultVisible: true, getValue: ({ conn }) => conn?.external_points_balance != null ? conn.external_points_balance.toLocaleString() : null },
  { key: "expiringPoints", section: "Points & Balance", label: "Expiring Points", apiName: "expiring_points", defaultVisible: true, getValue: ({ expiringPts }) => expiringPts > 0 ? `${expiringPts} pts` : null },

  // 4. Visits & Transactions
  { key: "progress", section: "Visits & Transactions", label: "Visit Progress", apiName: "visit_count", defaultVisible: true, getValue: ({ visits, brand }) => `${visits.length}/${brand.milestone_visits}` },
  { key: "visitExpiry", section: "Visits & Transactions", label: "Visit Expiry", apiName: "visit_expiry_months", defaultVisible: false, getValue: ({ brand }) => `${brand.visit_expiry_months} months` },
  { key: "milestone_visits", section: "Visits & Transactions", label: "Milestone Visits", apiName: "milestone_visits", defaultVisible: false, getValue: ({ brand }) => brand.milestone_visits },
  { key: "last_visit", section: "Visits & Transactions", label: "Last Visit", apiName: "last_visit_at", defaultVisible: false, getValue: ({ visits }) => visits.length > 0 ? format(new Date(visits[0].created_at), "MMM d, yyyy") : null },

  // 5. Partner & Integration
  { key: "loyalty_api_url", section: "Partner & Integration", label: "Loyalty API URL", apiName: "loyalty_api_url", defaultVisible: false, getValue: ({ brand }) => brand.loyalty_api_url },
  { key: "api_endpoint", section: "Partner & Integration", label: "API Endpoint", apiName: "api_endpoint", defaultVisible: false, getValue: ({ conn }) => conn?.api_endpoint ?? null },
  { key: "last_synced", section: "Partner & Integration", label: "Last Synced", apiName: "last_synced_at", defaultVisible: false, getValue: ({ conn }) => conn?.last_synced_at ? format(new Date(conn.last_synced_at), "MMM d, yyyy") : null },

  // 6. Branding & Metadata
  { key: "logo_emoji", section: "Branding & Metadata", label: "Logo", apiName: "logo_emoji", defaultVisible: false, getValue: ({ brand }) => brand.logo_emoji },
  { key: "websiteLink", section: "Branding & Metadata", label: "Website", apiName: "website_url", defaultVisible: false, getValue: ({ brand }) => brand.website_url },
  { key: "brand_id", section: "Branding & Metadata", label: "Brand ID", apiName: "brand_id", defaultVisible: false, getValue: ({ brand }) => brand.id },
  { key: "created_at", section: "Branding & Metadata", label: "Created At", apiName: "created_at", defaultVisible: false, getValue: ({ conn }) => conn?.created_at ? format(new Date(conn.created_at), "MMM d, yyyy") : null },
];

export const LOYALTY_SECTIONS = [...new Set(LOYALTY_API_FIELDS.map((f) => f.section))];

// ---- Persistence helpers ----
const STORAGE_KEY = "widget-visible-fields";

export function getVisibleWidgetFields(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return LOYALTY_API_FIELDS.filter((f) => f.defaultVisible).map((f) => f.key);
}

export function setVisibleWidgetFields(keys: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function resetVisibleWidgetFields(): string[] {
  localStorage.removeItem(STORAGE_KEY);
  return LOYALTY_API_FIELDS.filter((f) => f.defaultVisible).map((f) => f.key);
}

// Helper to get a field def by key
export function getFieldByKey(key: string) {
  return LOYALTY_API_FIELDS.find((f) => f.key === key);
}
