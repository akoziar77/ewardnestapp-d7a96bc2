
-- Prizes table
CREATE TABLE public.prizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  reward_type text NOT NULL DEFAULT 'points',
  reward_value text NOT NULL DEFAULT '0',
  weight integer NOT NULL DEFAULT 1,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prizes" ON public.prizes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Anyone can view active prizes" ON public.prizes FOR SELECT TO authenticated USING (active = true);

-- Spin logs table
CREATE TABLE public.spin_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  prize_id uuid REFERENCES public.prizes(id) NOT NULL,
  points_spent integer NOT NULL DEFAULT 50,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.spin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spin logs" ON public.spin_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage spin logs" ON public.spin_logs FOR ALL USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);
