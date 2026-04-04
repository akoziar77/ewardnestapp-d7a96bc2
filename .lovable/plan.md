
# RewardNest MVP — Enhanced Implementation Plan

## Gap Analysis vs JSON Spec

The previous implementation created the right pages but missed several spec-defined components. This plan closes every gap.

---

## 1. Home Screen (`wallet_home`) — 4 missing components

**Current state:** Has QR button, points card, quick actions, favorites. 
**Missing from spec:**

| Component | What to add |
|-----------|-------------|
| **PointsBadge** | A compact badge showing points + tier (e.g. "1,240 pts · Gold") below the header — the current card is verbose |
| **Active Rewards Carousel** | Horizontal swipeable carousel of the user's redeemable rewards (title, cost, subtitle) using `embla-carousel-react` (already installed) |
| **ActionRow** | Two side-by-side buttons: "Scan to Earn" (→ `/scan`) and "Rewards" (→ `/rewards`) with icons, placed below the QR button |
| **FooterNav** | Already exists via `BottomNav` ✅ but the spec only shows Home/History/Profile — we'll keep the current 5-tab nav as it's richer |

**Files:** `src/pages/Home.tsx`, new `src/components/home/PointsBadge.tsx`, new `src/components/home/ActiveRewardsCarousel.tsx`

---

## 2. QR Modal (`qr_modal`) ✅ Complete
- QR size in spec is 260px, current is 220px → bump to 260
- Otherwise matches spec perfectly

**Files:** `src/components/CustomerQRDialog.tsx`

---

## 3. Scan Page (`scan_camera`) ✅ Complete
- Camera + manual input + submit button all present
- Minor: add the spec hint text "Align merchant QR inside the frame" above scanner

**Files:** `src/pages/Scan.tsx`

---

## 4. Earn Success (`earn_success`) ✅ Complete
- Already shows check icon, points earned, merchant name, "Back to home" button

---

## 5. Rewards List (`rewards_list`) — minor polish
- Spec shows a footer text "Rewards may have expiry dates." — add if missing
- Otherwise the list + tap-to-redeem flow is complete

**Files:** `src/pages/Rewards.tsx`

---

## 6. Redeem Confirm + Success (`redeem_confirm` / `redeem_success`) ✅ Complete
- Dialog-based flow already handles both states

---

## 7. History ✅ Complete

---

## 8. Merchant Overview (`merchant_overview`) — add quick action links
- Spec shows "Scan Customer" and "Award Points" quick-action buttons
- Current `MerchantOverview.tsx` may not have these — add navigation buttons

**Files:** `src/pages/merchant/MerchantOverview.tsx`

---

## 9. Merchant Scan (`merchant_scan`) ✅ Complete

---

## 10. Award Points (`award_points`) ✅ Complete

---

## 11. Admin Ledger (`admin_ledger`) ✅ Complete

---

## 12. Landing Page (`landing_home`) — missing Screenshots section
- Spec includes a `Screenshots` component with 3 placeholder images
- Add a screenshots/preview gallery section with placeholder images

**Files:** `src/pages/Landing.tsx`

---

## 13. Pricing Page (`pricing_page`) ✅ Complete

---

## Summary of Work

| Priority | Task | Effort |
|----------|------|--------|
| 🔴 High | Add PointsBadge component to Home | Small |
| 🔴 High | Add Active Rewards Carousel to Home | Medium |
| 🔴 High | Add ActionRow (Scan + Rewards buttons) to Home | Small |
| 🟡 Med | Bump QR size to 260px in CustomerQRDialog | Trivial |
| 🟡 Med | Add scan hint text to Scan page | Trivial |
| 🟡 Med | Add Scan/Award quick actions to MerchantOverview | Small |
| 🟡 Med | Add Screenshots section to Landing page | Small |
| 🟢 Low | Add "Rewards may have expiry dates" note to Rewards page | Trivial |

**New files:** `src/components/home/PointsBadge.tsx`, `src/components/home/ActiveRewardsCarousel.tsx`
**Modified files:** `src/pages/Home.tsx`, `src/components/CustomerQRDialog.tsx`, `src/pages/Scan.tsx`, `src/pages/merchant/MerchantOverview.tsx`, `src/pages/Landing.tsx`, `src/pages/Rewards.tsx`

No database changes needed.
