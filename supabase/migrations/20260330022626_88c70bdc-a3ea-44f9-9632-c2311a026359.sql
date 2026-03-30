
-- ============================================
-- FIX 1: Remove direct user INSERT on redemptions
-- Edge functions use service_role so they bypass RLS
-- ============================================
DROP POLICY IF EXISTS "Users can insert own redemptions" ON public.redemptions;

-- ============================================
-- FIX 2: Protect sensitive profile columns
-- Create a trigger that prevents users from modifying
-- game-state and security columns directly
-- ============================================
CREATE OR REPLACE FUNCTION public.guard_profile_update()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- If the caller is service_role or an admin, allow all changes
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- For regular users, prevent changes to sensitive columns
  NEW.nest_points := OLD.nest_points;
  NEW.tier := OLD.tier;
  NEW.streak_count := OLD.streak_count;
  NEW.last_streak_date := OLD.last_streak_date;
  NEW.free_spins_used_today := OLD.free_spins_used_today;
  NEW.last_free_spin_date := OLD.last_free_spin_date;
  NEW.jackpot_meter := OLD.jackpot_meter;
  NEW.jackpot_increment := OLD.jackpot_increment;
  NEW.jackpot_max := OLD.jackpot_max;
  NEW.challenges_completed := OLD.challenges_completed;
  NEW.account_status := OLD.account_status;
  NEW.beta_tester := OLD.beta_tester;
  NEW.feature_flags := OLD.feature_flags;
  NEW.test_group := OLD.test_group;
  NEW.session_count := OLD.session_count;
  NEW.last_check_in := OLD.last_check_in;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_update();
