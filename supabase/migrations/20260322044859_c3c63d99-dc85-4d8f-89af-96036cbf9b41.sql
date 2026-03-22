-- Allow merchant members to update their own merchant
CREATE POLICY "Merchant staff can update merchant"
ON public.merchants FOR UPDATE
TO authenticated
USING (public.is_merchant_member(auth.uid(), id))
WITH CHECK (public.is_merchant_member(auth.uid(), id));