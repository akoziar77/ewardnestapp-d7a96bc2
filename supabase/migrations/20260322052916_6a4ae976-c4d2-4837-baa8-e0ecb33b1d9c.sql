
-- 1. Create a system merchant for platform-level rewards (brand milestones)
INSERT INTO public.merchants (id, name, category, provider)
VALUES ('00000000-0000-0000-0000-000000000001', 'RewardsNest Platform', 'Platform', 'system')
ON CONFLICT (id) DO NOTHING;

-- 2. Create function to award milestone points
CREATE OR REPLACE FUNCTION public.award_brand_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _brand RECORD;
  _visit_count INT;
  _current_balance INT;
  _idempotency TEXT;
BEGIN
  -- Get the brand info
  SELECT milestone_visits, milestone_points, name
    INTO _brand
    FROM public.brands
    WHERE id = NEW.brand_id;

  -- Count total visits for this user+brand (including the new one)
  SELECT COUNT(*)
    INTO _visit_count
    FROM public.brand_visits
    WHERE user_id = NEW.user_id
      AND brand_id = NEW.brand_id;

  -- Check if this visit exactly hits the milestone
  IF _visit_count = _brand.milestone_visits THEN
    -- Build an idempotency key so we never double-award
    _idempotency := 'brand_milestone_' || NEW.user_id || '_' || NEW.brand_id || '_' || _visit_count;

    -- Check if already awarded
    IF EXISTS (
      SELECT 1 FROM public.ledger_entries
      WHERE idempotency_key = _idempotency
    ) THEN
      RETURN NEW;
    END IF;

    -- Get current balance (latest ledger entry for this user across all merchants)
    SELECT COALESCE(
      (SELECT balance_after FROM public.ledger_entries
       WHERE user_id = NEW.user_id
       ORDER BY created_at DESC LIMIT 1),
      0
    ) INTO _current_balance;

    -- Insert the milestone reward ledger entry
    INSERT INTO public.ledger_entries (
      user_id, merchant_id, delta_points, balance_after,
      type, idempotency_key, metadata
    ) VALUES (
      NEW.user_id,
      '00000000-0000-0000-0000-000000000001',
      _brand.milestone_points,
      _current_balance + _brand.milestone_points,
      'brand_milestone',
      _idempotency,
      jsonb_build_object(
        'brand_id', NEW.brand_id,
        'brand_name', _brand.name,
        'visits_required', _brand.milestone_visits
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create the trigger on brand_visits
CREATE TRIGGER trg_brand_milestone_reward
  AFTER INSERT ON public.brand_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.award_brand_milestone();
