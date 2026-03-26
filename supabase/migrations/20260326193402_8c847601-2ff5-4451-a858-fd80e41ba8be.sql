ALTER TABLE public.profiles
  ADD COLUMN last_free_spin_date date,
  ADD COLUMN free_spins_used_today integer NOT NULL DEFAULT 0;