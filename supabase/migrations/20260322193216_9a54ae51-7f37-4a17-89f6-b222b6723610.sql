
-- Privacy policies table
CREATE TABLE public.privacy_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_markdown text NOT NULL,
  version text NOT NULL UNIQUE,
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.privacy_policies ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read published policies
CREATE POLICY "Anyone can view policies" ON public.privacy_policies
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage policies
CREATE POLICY "Admins can insert policies" ON public.privacy_policies
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update policies" ON public.privacy_policies
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can delete policies" ON public.privacy_policies
  FOR DELETE TO authenticated USING (is_admin());

-- User consents table
CREATE TABLE public.user_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version text NOT NULL,
  accepted boolean NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Users can view their own consents
CREATE POLICY "Users can view own consents" ON public.user_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can insert own consents
CREATE POLICY "Users can insert own consent" ON public.user_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Admins can view all consents
CREATE POLICY "Admins can view all consents" ON public.user_consents
  FOR SELECT TO authenticated USING (is_admin());
