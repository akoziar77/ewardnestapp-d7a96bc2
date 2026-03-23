
-- Add new columns to boosters for V2 types
ALTER TABLE public.boosters
  ADD COLUMN IF NOT EXISTS min_spend numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS required_brands integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS required_streak integer DEFAULT 0;

-- SKU booster rules
CREATE TABLE IF NOT EXISTS public.booster_sku_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booster_id uuid NOT NULL REFERENCES public.boosters(id) ON DELETE CASCADE,
  sku_keyword text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.booster_sku_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage booster sku rules"
  ON public.booster_sku_rules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Anyone can view booster sku rules"
  ON public.booster_sku_rules FOR SELECT
  TO authenticated
  USING (true);

-- Category booster rules
CREATE TABLE IF NOT EXISTS public.booster_category_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booster_id uuid NOT NULL REFERENCES public.boosters(id) ON DELETE CASCADE,
  category_keyword text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.booster_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage booster category rules"
  ON public.booster_category_rules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Anyone can view booster category rules"
  ON public.booster_category_rules FOR SELECT
  TO authenticated
  USING (true);
