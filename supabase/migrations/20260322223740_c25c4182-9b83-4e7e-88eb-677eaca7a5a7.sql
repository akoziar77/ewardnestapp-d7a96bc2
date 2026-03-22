
-- Add Engage+ fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nest_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'Hatchling',
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_check_in timestamp with time zone,
  ADD COLUMN IF NOT EXISTS challenges_completed integer NOT NULL DEFAULT 0;

-- Create challenges table
CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'action_count',
  requirement integer NOT NULL DEFAULT 1,
  reward_points integer NOT NULL DEFAULT 50,
  active boolean NOT NULL DEFAULT true,
  icon_name text NOT NULL DEFAULT 'Target',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS for challenges
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage challenges"
  ON public.challenges FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- User challenge progress tracking
CREATE TABLE public.user_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenge progress"
  ON public.user_challenges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user challenges"
  ON public.user_challenges FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Nest activities log
CREATE TABLE public.nest_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.nest_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nest activities"
  ON public.nest_activities FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage nest activities"
  ON public.nest_activities FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
