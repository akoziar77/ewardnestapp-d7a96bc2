import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PageAccessProvider } from "@/contexts/PageAccessContext";
import { useRoles } from "@/hooks/useRoles";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageGate } from "@/components/PageGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Scan from "./pages/Scan";
import Rewards from "./pages/Rewards";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Brands from "./pages/Brands";
import BrandSettings from "./pages/BrandSettings";
import MerchantLogin from "./pages/merchant/MerchantLogin";
import MerchantLayout from "./pages/merchant/MerchantLayout";
import MerchantOverview from "./pages/merchant/MerchantOverview";
import MerchantRewards from "./pages/merchant/MerchantRewards";
import MerchantRedemptions from "./pages/merchant/MerchantRedemptions";
import MerchantQR from "./pages/merchant/MerchantQR";
import MerchantInsights from "./pages/merchant/MerchantInsights";
import MerchantBoosters from "./pages/merchant/MerchantBoosters";
import MerchantOnboarding from "./pages/merchant/MerchantOnboarding";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";
import Engage from "./pages/Engage";
import ManageTiers from "./pages/ManageTiers";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminPageAccess from "./pages/admin/AdminPageAccess";
import AdminPrivacyPolicy from "./pages/admin/AdminPrivacyPolicy";
import AdminQuickActions from "./pages/admin/AdminQuickActions";
import AdminOnboarding from "./pages/admin/AdminOnboarding";
import AdminPageDirectory from "./pages/admin/AdminPageDirectory";
import AdminBoosters from "./pages/admin/AdminBoosters";
import AdminReceiptReview from "./pages/admin/AdminReceiptReview";
import AdminInsights from "./pages/admin/AdminInsights";
import AdminWebhooks from "./pages/admin/AdminWebhooks";
import ReceiptUpload from "./pages/ReceiptUpload";
import ConsentBanner from "./components/ConsentBanner";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();
  const signedIn = !!user;

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/merchant/login" element={<MerchantLogin />} />

      {/* Signed-in: any role (user, manager, admin) */}
      <Route element={<ProtectedRoute signedIn={signedIn} roles={roles} required={["user", "manager", "admin"]} />}>
        <Route path="/" element={<PageGate pageKey="home"><Index /></PageGate>} />
        <Route path="/home" element={<PageGate pageKey="home"><Index /></PageGate>} />
        <Route path="/onboarding" element={<PageGate pageKey="onboarding"><Onboarding /></PageGate>} />
        <Route path="/scan" element={<PageGate pageKey="scan"><Scan /></PageGate>} />
        <Route path="/rewards" element={<PageGate pageKey="rewards"><Rewards /></PageGate>} />
        <Route path="/history" element={<PageGate pageKey="history"><History /></PageGate>} />
        <Route path="/profile" element={<PageGate pageKey="profile"><Profile /></PageGate>} />
        <Route path="/brands" element={<PageGate pageKey="brands"><Brands /></PageGate>} />
        <Route path="/brands/settings" element={<PageGate pageKey="brands_settings"><BrandSettings /></PageGate>} />
        <Route path="/engage" element={<PageGate pageKey="engage"><Engage /></PageGate>} />
        <Route path="/receipts" element={<PageGate pageKey="receipts"><ReceiptUpload /></PageGate>} />
      </Route>

      {/* Manager or admin */}
      <Route element={<ProtectedRoute signedIn={signedIn} roles={roles} required={["manager", "admin"]} />}>
        <Route path="/manage-tiers" element={<PageGate pageKey="manage_tiers"><ManageTiers /></PageGate>} />
        <Route path="/merchant/onboarding" element={<PageGate pageKey="merchant_onboarding"><MerchantOnboarding /></PageGate>} />
        <Route path="/merchant" element={<PageGate pageKey="merchant_dashboard"><MerchantLayout /></PageGate>}>
          <Route index element={<MerchantOverview />} />
          <Route path="rewards" element={<MerchantRewards />} />
          <Route path="redemptions" element={<MerchantRedemptions />} />
          <Route path="qr" element={<MerchantQR />} />
          <Route path="insights" element={<MerchantInsights />} />
          <Route path="boosters" element={<MerchantBoosters />} />
        </Route>
      </Route>

      {/* Admin only */}
      <Route element={<ProtectedRoute signedIn={signedIn} roles={roles} required={["admin"]} />}>
        <Route path="/admin/roles" element={<PageGate pageKey="admin_roles"><AdminRoles /></PageGate>} />
        <Route path="/admin/page-access" element={<PageGate pageKey="admin_page_access"><AdminPageAccess /></PageGate>} />
        <Route path="/admin/privacy-policy" element={<PageGate pageKey="admin_privacy_policy"><AdminPrivacyPolicy /></PageGate>} />
        <Route path="/admin/quick-actions" element={<PageGate pageKey="admin_quick_actions"><AdminQuickActions /></PageGate>} />
        <Route path="/admin/onboarding" element={<PageGate pageKey="admin_onboarding"><AdminOnboarding /></PageGate>} />
        <Route path="/admin/pages" element={<PageGate pageKey="admin_page_directory"><AdminPageDirectory /></PageGate>} />
        <Route path="/admin/boosters" element={<PageGate pageKey="admin_boosters"><AdminBoosters /></PageGate>} />
        <Route path="/admin/receipts" element={<PageGate pageKey="admin_receipts"><AdminReceiptReview /></PageGate>} />
        <Route path="/admin/insights" element={<PageGate pageKey="admin_insights"><AdminInsights /></PageGate>} />
        <Route path="/admin/webhooks" element={<PageGate pageKey="admin_webhooks"><AdminWebhooks /></PageGate>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <AuthProvider>
      <PageAccessProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
            <ConsentBanner />
          </BrowserRouter>
        </TooltipProvider>
      </PageAccessProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
