
-- Allow service role to update and delete brand_locations (needed for merge/update logic)
CREATE POLICY "Service role can update brand locations"
ON public.brand_locations FOR UPDATE TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can delete brand locations"
ON public.brand_locations FOR DELETE TO public
USING (auth.role() = 'service_role'::text);
