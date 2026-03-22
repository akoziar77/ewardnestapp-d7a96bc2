
-- Add visit expiry window to brands (months after which a visit no longer counts)
ALTER TABLE public.brands
  ADD COLUMN visit_expiry_months integer NOT NULL DEFAULT 6;

-- Add expiration timestamp to ledger entries for earned points
ALTER TABLE public.ledger_entries
  ADD COLUMN expires_at timestamptz DEFAULT NULL;

-- Update the milestone trigger to set expires_at (90 days from award)
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
  _expiry_months INT;
BEGIN
  SELECT milestone_visits, milestone_points, name, visit_expiry_months
    INTO _brand
    FROM public.brands
    WHERE id = NEW.brand_id;

  _expiry_months := COALESCE(_brand.visit_expiry_months, 6);

  -- Count only non-expired visits
  SELECT COUNT(*)
    INTO _visit_count
    FROM public.brand_visits
    WHERE user_id = NEW.user_id
      AND brand_id = NEW.brand_id
      AND created_at > now() - (_expiry_months || ' months')::interval;

  IF _visit_count = _brand.milestone_visits THEN
    _idempotency := 'brand_milestone_' || NEW.user_id || '_' || NEW.brand_id || '_' || _visit_count;

    IF EXISTS (
      SELECT 1 FROM public.ledger_entries
      WHERE idempotency_key = _idempotency
    ) THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(
      (SELECT balance_after FROM public.ledger_entries
       WHERE user_id = NEW.user_id
       ORDER BY created_at DESC LIMIT 1),
      0
    ) INTO _current_balance;

    INSERT INTO public.ledger_entries (
      user_id, merchant_id, delta_points, balance_after,
      type, idempotency_key, metadata, expires_at
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
      ),
      now() + interval '3 months'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Set default expiry for existing brand milestone entries that don't have one
UPDATE public.ledger_entries
SET expires_at = created_at + interval '3 months'
WHERE type = 'brand_milestone' AND expires_at IS NULL;
