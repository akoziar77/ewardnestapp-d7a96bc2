
CREATE TABLE public.wallet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  doc_type text NOT NULL,
  title text NOT NULL,
  card_number text,
  expiry_date text,
  notes text,
  front_image_path text,
  back_image_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet items"
  ON public.wallet_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet items"
  ON public.wallet_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet items"
  ON public.wallet_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wallet items"
  ON public.wallet_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
