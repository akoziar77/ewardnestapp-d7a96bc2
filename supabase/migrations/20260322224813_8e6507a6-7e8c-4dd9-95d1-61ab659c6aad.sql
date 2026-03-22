
CREATE TABLE public.booster_tier_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booster_id uuid NOT NULL REFERENCES public.boosters(id) ON DELETE CASCADE,
  tier text NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1,
  bonus integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booster_id, tier)
);

ALTER TABLE public.booster_tier_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view booster tier rules"
  ON public.booster_tier_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage booster tier rules"
  ON public.booster_tier_rules FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
