
-- Notification preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_notifications boolean NOT NULL DEFAULT false;

-- Device & PWA metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS pwa_installed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS install_date timestamptz,
  ADD COLUMN IF NOT EXISTS last_device_sync timestamptz;

-- Beta testing fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS beta_tester boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_group varchar(5) NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS session_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_brands jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Account status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status varchar(20) NOT NULL DEFAULT 'active';

-- Referrals table (normalized, not JSONB blobs)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text NOT NULL UNIQUE,
  reward_points integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);

-- Add referral_code to profiles for quick lookup
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by text;

-- RLS on referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can insert own referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Admins can manage all referrals"
  ON public.referrals FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_beta_tester ON public.profiles(beta_tester);
