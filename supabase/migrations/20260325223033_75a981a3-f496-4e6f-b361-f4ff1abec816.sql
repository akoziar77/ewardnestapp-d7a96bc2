
-- Allow admins to insert brands
CREATE POLICY "Admins can insert brands"
ON public.brands
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Allow admins to update brands
CREATE POLICY "Admins can update brands"
ON public.brands
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Allow admins to delete brands
CREATE POLICY "Admins can delete brands"
ON public.brands
FOR DELETE
TO authenticated
USING (is_admin());
