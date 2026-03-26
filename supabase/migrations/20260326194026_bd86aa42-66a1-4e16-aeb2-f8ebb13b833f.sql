ALTER TABLE public.profiles
  ADD COLUMN jackpot_meter integer NOT NULL DEFAULT 0,
  ADD COLUMN jackpot_increment integer NOT NULL DEFAULT 1,
  ADD COLUMN jackpot_max integer NOT NULL DEFAULT 25;