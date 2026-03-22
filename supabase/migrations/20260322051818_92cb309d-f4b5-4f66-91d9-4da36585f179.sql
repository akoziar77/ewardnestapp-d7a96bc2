
-- National brands catalog
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_emoji text NOT NULL DEFAULT '🏪',
  category text,
  milestone_visits integer NOT NULL DEFAULT 10,
  milestone_points integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brands"
ON public.brands FOR SELECT
TO authenticated
USING (true);

-- Brand visit log
CREATE TABLE public.brand_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visits"
ON public.brand_visits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can log own visits"
ON public.brand_visits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own visits"
ON public.brand_visits FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Seed popular national brands
INSERT INTO public.brands (name, logo_emoji, category, milestone_visits, milestone_points) VALUES
  ('Starbucks', '☕', 'Coffee', 10, 150),
  ('Target', '🎯', 'Retail', 8, 120),
  ('Walgreens', '💊', 'Pharmacy', 10, 100),
  ('Chipotle', '🌯', 'Dining', 8, 120),
  ('Nike', '👟', 'Apparel', 5, 200),
  ('Sephora', '💄', 'Beauty', 6, 150),
  ('Whole Foods', '🥑', 'Grocery', 10, 100),
  ('Costco', '📦', 'Wholesale', 5, 150),
  ('Chick-fil-A', '🐔', 'Dining', 10, 120),
  ('Trader Joe''s', '🛒', 'Grocery', 10, 100);
