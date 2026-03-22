
-- Merchant users: links auth users to merchants as owners/staff
CREATE TABLE public.merchant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, merchant_id)
);

ALTER TABLE public.merchant_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to check merchant membership
CREATE OR REPLACE FUNCTION public.is_merchant_member(_user_id UUID, _merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users
    WHERE user_id = _user_id AND merchant_id = _merchant_id
  )
$$;

-- Function to get user's merchant id
CREATE OR REPLACE FUNCTION public.get_user_merchant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT merchant_id FROM public.merchant_users
  WHERE user_id = _user_id LIMIT 1
$$;

CREATE POLICY "Merchant users can view own memberships" ON public.merchant_users
  FOR SELECT USING (auth.uid() = user_id);

-- Redemptions table
CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  external_txn_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- Users can see own redemptions
CREATE POLICY "Users can view own redemptions" ON public.redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- Merchant owners can see redemptions for their merchant
CREATE POLICY "Merchant staff can view merchant redemptions" ON public.redemptions
  FOR SELECT USING (public.is_merchant_member(auth.uid(), merchant_id));

-- Allow merchants to manage their own rewards
CREATE POLICY "Merchant staff can insert rewards" ON public.rewards
  FOR INSERT WITH CHECK (public.is_merchant_member(auth.uid(), merchant_id));

CREATE POLICY "Merchant staff can update rewards" ON public.rewards
  FOR UPDATE USING (public.is_merchant_member(auth.uid(), merchant_id));

-- Allow merchant staff to view ledger entries for their merchant
CREATE POLICY "Merchant staff can view merchant ledger" ON public.ledger_entries
  FOR SELECT USING (public.is_merchant_member(auth.uid(), merchant_id));

-- Allow merchants to insert ledger entries (for redemptions)
CREATE POLICY "Merchant staff can insert ledger entries" ON public.ledger_entries
  FOR INSERT WITH CHECK (public.is_merchant_member(auth.uid(), merchant_id));
