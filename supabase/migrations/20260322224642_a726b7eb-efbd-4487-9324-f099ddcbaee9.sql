
-- 1. boosters table
CREATE TABLE public.boosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'multiplier',
  multiplier_value numeric NOT NULL DEFAULT 1,
  bonus_value integer NOT NULL DEFAULT 0,
  required_action text NOT NULL DEFAULT 'any',
  required_tier text NOT NULL DEFAULT 'any',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active boosters"
  ON public.boosters FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage boosters"
  ON public.boosters FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- 2. booster_user_targets table
CREATE TABLE public.booster_user_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booster_id uuid NOT NULL REFERENCES public.boosters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booster_id, user_id)
);

ALTER TABLE public.booster_user_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own booster targets"
  ON public.booster_user_targets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage booster targets"
  ON public.booster_user_targets FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3. booster_activity_log table
CREATE TABLE public.booster_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  booster_id uuid NOT NULL REFERENCES public.boosters(id) ON DELETE CASCADE,
  action text NOT NULL,
  base_points integer NOT NULL DEFAULT 0,
  bonus_points integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booster_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own booster activity"
  ON public.booster_activity_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage booster activity"
  ON public.booster_activity_log FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
