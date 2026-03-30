

# RewardNest MVP Screen Spec Implementation Plan

## Overview
The spec describes 14 screens. Most already exist in the codebase with similar functionality. This plan focuses on **new screens and meaningful gaps** between the spec and current implementation.

## What Already Exists (minor tweaks only)
- **scan_camera / earn_success** — `Scan.tsx` handles camera, success, and error states
- **rewards_list / redeem_confirm / redeem_success** — `Rewards.tsx` with dialog-based redemption flow
- **history** — `History.tsx` with filtering and grouping
- **merchant_overview** — `MerchantOverview.tsx` with KPI cards and recent activity
- **pricing_page** — `Pricing.tsx` with Stripe checkout

## New / Significantly Changed Screens

### 1. Customer QR Modal on Home (`qr_modal`)
- Add a "Show QR to cashier" button to the Home page
- Open a dialog/sheet displaying a QR code encoding `customer:{user_id}`
- Include a "Copy ID" button for clipboard copy
- Use `qrcode.react` library to render the QR

### 2. Manual Code Input on Scan (`scan_camera` enhancement)
- Add a text input below the camera view for manual merchant code entry
- Add a "Submit Code" button that calls the same `scan-checkin` edge function
- Keeps existing camera scanning flow intact

### 3. Merchant Scan Page (`merchant_scan`)
- New page at `/merchant/scan` — camera view to scan customer QR codes
- Manual input field for customer ID or phone lookup
- On success, navigate to award points page with customer context
- Add route to `MerchantLayout` and nav items

### 4. Award Points Page (`award_points`)
- New page at `/merchant/award` — form to manually award points
- Shows customer card (name, visits, current points)
- Fields: points amount, reason
- Calls existing `scan-checkin` or a new lightweight edge function
- Add route to `MerchantLayout`

### 5. Admin Ledger Page (`admin_ledger`)
- New page at `/admin/ledger` — filterable table of all ledger entries
- Filters: date range, merchant, transaction type
- Columns: id, timestamp, type, merchant, customer, points, reference
- Uses existing `ledger_entries` table with admin RLS (already in place)
- Add route to `AdminLayout`

### 6. Landing Page (`landing_home`)
- New page at `/landing` (public route)
- Hero section with headline, subtitle, two CTAs
- "How It Works" 3-step section
- Screenshot placeholders
- Pricing teaser linking to `/pricing`

## Files to Create
| File | Purpose |
|------|---------|
| `src/pages/Landing.tsx` | Public landing page |
| `src/pages/admin/AdminLedger.tsx` | Admin ledger table |
| `src/pages/merchant/MerchantScan.tsx` | Merchant customer scanning |
| `src/pages/merchant/MerchantAwardPoints.tsx` | Award points form |

## Files to Modify
| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Add "Show QR" button + QR dialog |
| `src/pages/Scan.tsx` | Add manual code input field |
| `src/pages/merchant/MerchantLayout.tsx` | Add scan + award routes to nav |
| `src/pages/admin/AdminLayout.tsx` | Add ledger route to sidebar |
| `src/App.tsx` | Register new routes (`/landing`, `/admin/ledger`, `/merchant/scan`, `/merchant/award`) |
| `package.json` | Add `qrcode.react` dependency |

## Technical Notes
- QR code generation uses `qrcode.react` (lightweight, React-native)
- All new pages follow existing patterns: React Query for data, Supabase client for queries, shadcn/ui components
- Admin ledger uses existing admin RLS policies on `ledger_entries`
- Merchant scan reuses `html5-qrcode` library already installed
- No database migrations needed — all tables and RLS are already in place

