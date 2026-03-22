
-- Dynamic page-role access control
CREATE TABLE public.page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  page_label text NOT NULL,
  role_name text NOT NULL CHECK (role_name IN ('admin', 'manager', 'user')),
  allowed boolean NOT NULL DEFAULT false,
  UNIQUE(page_key, role_name)
);

ALTER TABLE public.page_access ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed for route guards)
CREATE POLICY page_access_read ON public.page_access
  FOR SELECT TO authenticated USING (true);

-- Only admins can modify
CREATE POLICY page_access_admin_insert ON public.page_access
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY page_access_admin_update ON public.page_access
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY page_access_admin_delete ON public.page_access
  FOR DELETE TO authenticated USING (public.is_admin());

-- Seed with current route configuration
INSERT INTO public.page_access (page_key, page_label, role_name, allowed) VALUES
  -- Pages accessible to all signed-in roles
  ('home', 'Home', 'user', true),
  ('home', 'Home', 'manager', true),
  ('home', 'Home', 'admin', true),
  ('onboarding', 'Onboarding', 'user', true),
  ('onboarding', 'Onboarding', 'manager', true),
  ('onboarding', 'Onboarding', 'admin', true),
  ('scan', 'Scan', 'user', true),
  ('scan', 'Scan', 'manager', true),
  ('scan', 'Scan', 'admin', true),
  ('rewards', 'Rewards', 'user', true),
  ('rewards', 'Rewards', 'manager', true),
  ('rewards', 'Rewards', 'admin', true),
  ('history', 'History', 'user', true),
  ('history', 'History', 'manager', true),
  ('history', 'History', 'admin', true),
  ('profile', 'Profile', 'user', true),
  ('profile', 'Profile', 'manager', true),
  ('profile', 'Profile', 'admin', true),
  ('brands', 'Brands', 'user', true),
  ('brands', 'Brands', 'manager', true),
  ('brands', 'Brands', 'admin', true),
  ('brands_settings', 'Brand Settings', 'user', true),
  ('brands_settings', 'Brand Settings', 'manager', true),
  ('brands_settings', 'Brand Settings', 'admin', true),
  -- Manager + Admin pages
  ('manage_tiers', 'Manage Tiers', 'user', false),
  ('manage_tiers', 'Manage Tiers', 'manager', true),
  ('manage_tiers', 'Manage Tiers', 'admin', true),
  ('merchant_onboarding', 'Merchant Onboarding', 'user', false),
  ('merchant_onboarding', 'Merchant Onboarding', 'manager', true),
  ('merchant_onboarding', 'Merchant Onboarding', 'admin', true),
  ('merchant_dashboard', 'Merchant Dashboard', 'user', false),
  ('merchant_dashboard', 'Merchant Dashboard', 'manager', true),
  ('merchant_dashboard', 'Merchant Dashboard', 'admin', true),
  -- Admin only pages
  ('admin_roles', 'Admin Roles', 'user', false),
  ('admin_roles', 'Admin Roles', 'manager', false),
  ('admin_roles', 'Admin Roles', 'admin', true),
  ('admin_page_access', 'Page Access Control', 'user', false),
  ('admin_page_access', 'Page Access Control', 'manager', false),
  ('admin_page_access', 'Page Access Control', 'admin', true);
