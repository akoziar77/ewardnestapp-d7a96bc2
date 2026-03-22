-- Allow authenticated users to insert redemptions (the edge function uses service role, but let's also allow client-side if needed)
CREATE POLICY "Users can insert own redemptions"
ON public.redemptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);