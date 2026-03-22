-- Allow authenticated users to create merchants
CREATE POLICY "Authenticated users can create merchants"
ON public.merchants FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to create their own merchant_users entry
CREATE POLICY "Users can create own merchant membership"
ON public.merchant_users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);