CREATE OR REPLACE FUNCTION public.submit_transaction(
  amount numeric,
  merchant_id uuid,
  user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _earn_rate numeric;
  _points_earned integer;
  _current_balance integer;
  _txn_id uuid;
  _ledger_id uuid;
  _idempotency text;
  _brand_exists boolean;
BEGIN
  -- Check if merchant_id exists in brands table (they may differ)
  SELECT EXISTS (SELECT 1 FROM public.brands WHERE id = submit_transaction.merchant_id)
    INTO _brand_exists;

  -- Look up earn rate from brand_settings; default to 1 point per dollar
  SELECT COALESCE(bs.earn_rate, 1)
    INTO _earn_rate
    FROM public.brand_settings bs
    WHERE bs.brand_id = submit_transaction.merchant_id
    LIMIT 1;

  IF _earn_rate IS NULL THEN
    _earn_rate := 1;
  END IF;

  _points_earned := floor(submit_transaction.amount * _earn_rate)::integer;

  -- Only insert into transactions if the merchant is also a brand
  IF _brand_exists THEN
    INSERT INTO public.transactions (amount, brand_id, user_id, points_earned, source)
    VALUES (submit_transaction.amount, submit_transaction.merchant_id, submit_transaction.user_id, _points_earned, 'rpc')
    RETURNING id INTO _txn_id;
  ELSE
    _txn_id := gen_random_uuid(); -- synthetic ID for ledger reference
  END IF;

  -- Get current balance
  SELECT COALESCE(
    (SELECT balance_after FROM public.ledger_entries
     WHERE ledger_entries.user_id = submit_transaction.user_id
     ORDER BY created_at DESC LIMIT 1),
    0
  ) INTO _current_balance;

  _idempotency := 'txn_' || _txn_id::text;

  -- Insert ledger entry (always)
  INSERT INTO public.ledger_entries (
    user_id, merchant_id, delta_points, balance_after,
    type, idempotency_key, metadata
  ) VALUES (
    submit_transaction.user_id,
    submit_transaction.merchant_id,
    _points_earned,
    _current_balance + _points_earned,
    'earn',
    _idempotency,
    jsonb_build_object('transaction_id', _txn_id, 'amount', submit_transaction.amount, 'earn_rate', _earn_rate)
  )
  RETURNING id INTO _ledger_id;

  RETURN jsonb_build_object(
    'transaction_id', _txn_id,
    'ledger_id', _ledger_id,
    'points_earned', _points_earned,
    'balance_after', _current_balance + _points_earned
  );
END;
$$;