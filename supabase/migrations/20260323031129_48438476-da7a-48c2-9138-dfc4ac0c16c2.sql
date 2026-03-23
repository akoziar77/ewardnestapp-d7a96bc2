
-- Event source enum
CREATE TYPE event_source AS ENUM ('system', 'user', 'admin');

-- Delivery status enum
CREATE TYPE delivery_status AS ENUM ('pending', 'success', 'failed', 'retrying', 'dead');

-- Event types registry
CREATE TABLE public.event_types (
  id SERIAL PRIMARY KEY,
  event_key TEXT UNIQUE NOT NULL,
  description TEXT
);

-- Seed event types
INSERT INTO public.event_types (event_key, description) VALUES
  ('receipt.uploaded', 'A user uploaded a receipt'),
  ('receipt.parsed', 'Receipt OCR + parsing completed'),
  ('receipt.approved', 'Admin approved a receipt'),
  ('receipt.rejected', 'Admin rejected a receipt'),
  ('points.awarded', 'Points awarded to a user'),
  ('booster.activated', 'A booster was triggered'),
  ('streak.updated', 'A user streak was updated');

-- Central event log
CREATE TABLE public.event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL REFERENCES public.event_types(event_key),
  source event_source NOT NULL DEFAULT 'system',
  actor_id UUID,
  brand_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_log_type_idx ON public.event_log(event_type);
CREATE INDEX event_log_brand_idx ON public.event_log(brand_id);
CREATE INDEX event_log_created_idx ON public.event_log(created_at DESC);

-- Webhook subscriptions (brand-level)
CREATE TABLE public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL REFERENCES public.event_types(event_key),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhook_subscriptions_brand_idx ON public.webhook_subscriptions(brand_id);
CREATE INDEX webhook_subscriptions_event_idx ON public.webhook_subscriptions(event_type);

-- Webhook delivery log
CREATE TABLE public.webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.event_log(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL DEFAULT 1,
  status delivery_status NOT NULL DEFAULT 'pending',
  response_status INT,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhook_delivery_log_event_idx ON public.webhook_delivery_log(event_id);
CREATE INDEX webhook_delivery_log_subscription_idx ON public.webhook_delivery_log(subscription_id);

-- Dead letter queue
CREATE TABLE public.dlq_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_log(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dlq_event_idx ON public.dlq_events(event_id);

-- Event replay queue
CREATE TABLE public.event_replay_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_log(id) ON DELETE CASCADE,
  requested_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false
);

-- RLS policies
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlq_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_replay_queue ENABLE ROW LEVEL SECURITY;

-- event_types: anyone can read
CREATE POLICY "Anyone can view event types" ON public.event_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage event types" ON public.event_types FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- event_log: service role writes, admins read
CREATE POLICY "Service role can manage event log" ON public.event_log FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins can view event log" ON public.event_log FOR SELECT TO authenticated USING (is_admin());

-- webhook_subscriptions: service role + admins
CREATE POLICY "Service role can manage webhook subs" ON public.webhook_subscriptions FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins can manage webhook subs" ON public.webhook_subscriptions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- webhook_delivery_log: service role writes, admins read
CREATE POLICY "Service role can manage delivery log" ON public.webhook_delivery_log FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins can view delivery log" ON public.webhook_delivery_log FOR SELECT TO authenticated USING (is_admin());

-- dlq_events: service role writes, admins read
CREATE POLICY "Service role can manage dlq" ON public.dlq_events FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins can view dlq" ON public.dlq_events FOR SELECT TO authenticated USING (is_admin());

-- event_replay_queue: admins manage
CREATE POLICY "Service role can manage replay queue" ON public.event_replay_queue FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins can manage replay queue" ON public.event_replay_queue FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
