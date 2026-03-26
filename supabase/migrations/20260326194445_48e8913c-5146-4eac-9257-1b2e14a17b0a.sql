-- Add last_streak_date to profiles (streak_count already exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_streak_date date;

-- Create store_rewards table
CREATE TABLE public.store_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cost_points integer NOT NULL,
  reward_type text NOT NULL DEFAULT 'item',
  reward_value text NOT NULL DEFAULT '',
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active store rewards" ON public.store_rewards
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Admins can manage store rewards" ON public.store_rewards
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());