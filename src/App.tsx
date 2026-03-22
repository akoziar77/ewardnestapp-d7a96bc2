import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Scan from "./pages/Scan";
import Rewards from "./pages/Rewards";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Brands from "./pages/Brands";
import MerchantLogin from "./pages/merchant/MerchantLogin";
import MerchantLayout from "./pages/merchant/MerchantLayout";
import MerchantOverview from "./pages/merchant/MerchantOverview";
import MerchantRewards from "./pages/merchant/MerchantRewards";
import MerchantRedemptions from "./pages/merchant/MerchantRedemptions";
import MerchantQR from "./pages/merchant/MerchantQR";
import MerchantOnboarding from "./pages/merchant/MerchantOnboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/merchant/login" element={<MerchantLogin />} />
            <Route path="/merchant/onboarding" element={<MerchantOnboarding />} />
            <Route path="/merchant" element={<MerchantLayout />}>
              <Route index element={<MerchantOverview />} />
              <Route path="rewards" element={<MerchantRewards />} />
              <Route path="redemptions" element={<MerchantRedemptions />} />
              <Route path="qr" element={<MerchantQR />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
