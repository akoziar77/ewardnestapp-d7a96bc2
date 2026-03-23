
-- =======================================================
-- TRANSACTIONS TABLE
-- =======================================================
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id),
  amount numeric NOT NULL,
  points_earned integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'purchase',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions" ON public.transactions
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =======================================================
-- TIER PROGRESSION TABLE
-- =======================================================
CREATE TABLE public.tier_progression (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id),
  current_tier text NOT NULL DEFAULT 'Bronze',
  lifetime_spend numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, brand_id)
);

ALTER TABLE public.tier_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tier progression" ON public.tier_progression
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage tier progression" ON public.tier_progression
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =======================================================
-- BRAND SETTINGS TABLE
-- =======================================================
CREATE TABLE public.brand_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.brands(id) UNIQUE,
  earn_rate numeric NOT NULL DEFAULT 1,
  redemption_rate numeric NOT NULL DEFAULT 0.01,
  tier_thresholds jsonb DEFAULT '{"Silver": 500, "Gold": 2000, "Platinum": 5000}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brand settings" ON public.brand_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage brand settings" ON public.brand_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- =======================================================
-- ADMIN SETTINGS TABLE (singleton row)
-- =======================================================
CREATE TABLE public.admin_settings (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  maintenance_mode boolean NOT NULL DEFAULT false,
  global_multiplier numeric NOT NULL DEFAULT 1,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view admin settings" ON public.admin_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage admin settings" ON public.admin_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Seed the singleton row
INSERT INTO public.admin_settings (id, maintenance_mode, global_multiplier) VALUES (1, false, 1);

-- =======================================================
-- SYSTEM LOGS TABLE
-- =======================================================
CREATE TABLE public.system_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system logs" ON public.system_logs
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Service role can manage system logs" ON public.system_logs
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
