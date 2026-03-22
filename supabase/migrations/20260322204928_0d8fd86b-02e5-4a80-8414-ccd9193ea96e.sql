
CREATE TABLE public.onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_name text NOT NULL DEFAULT 'Sparkles',
  color_class text NOT NULL DEFAULT 'bg-primary',
  step_type text NOT NULL DEFAULT 'intro',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active onboarding steps"
  ON public.onboarding_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert onboarding steps"
  ON public.onboarding_steps FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update onboarding steps"
  ON public.onboarding_steps FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete onboarding steps"
  ON public.onboarding_steps FOR DELETE
  TO authenticated
  USING (is_admin());

-- Seed with existing hardcoded steps
INSERT INTO public.onboarding_steps (title, description, icon_name, color_class, step_type, sort_order) VALUES
  ('All your rewards, one nest', 'No more juggling cards or forgetting points. We bring every loyalty program into a single view.', 'Bird', 'bg-primary', 'intro', 0),
  ('Earn & redeem everywhere', 'Scan a QR code at any partner merchant. Points accumulate automatically and you can redeem rewards instantly.', 'Gift', 'bg-secondary', 'intro', 1),
  ('Smart suggestions', 'We''ll nudge you when a reward is about to expire or when there''s a deal you''d love. No spam, just value.', 'Sparkles', 'bg-primary', 'intro', 2),
  ('Stay in the loop', 'Enable location and notifications so we can alert you when you''re near a partner brand and your rewards are ready.', 'Bell', 'bg-primary', 'permissions', 3),
  ('Link your merchants', 'Pick the places you visit. You can always add more later.', 'QrCode', 'bg-secondary', 'merchant_select', 4);
