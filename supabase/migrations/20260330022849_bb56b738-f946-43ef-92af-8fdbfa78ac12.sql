-- Ensure regular users cannot reassign profile ownership on update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure the profile guard trigger is attached exactly once
DROP TRIGGER IF EXISTS trg_guard_profile_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_update();