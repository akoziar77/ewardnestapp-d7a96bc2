
-- Merge duplicate brands: reassign locations from newer to older, then delete newer

-- Circle K: move locations from c7fc065c to 86a0a169
UPDATE public.brand_locations SET brand_id = '86a0a169-2b0e-461f-867f-e759a958aaa6'
WHERE brand_id = 'c7fc065c-826f-4989-8bff-d1f14a62c656';

DELETE FROM public.brands WHERE id = 'c7fc065c-826f-4989-8bff-d1f14a62c656';

-- Kroger: move locations from 8df4773b to a29aee57
UPDATE public.brand_locations SET brand_id = 'a29aee57-dcd9-4b0c-b217-0e3ea4488a4a'
WHERE brand_id = '8df4773b-6d71-4c98-849d-fcb99aec8f4c';

DELETE FROM public.brands WHERE id = '8df4773b-6d71-4c98-849d-fcb99aec8f4c';

-- Sheetz: move locations from d78e0cbf to cc480fb6
UPDATE public.brand_locations SET brand_id = 'cc480fb6-ffb9-4043-80bb-db0a89245357'
WHERE brand_id = 'd78e0cbf-57d0-45bf-b8d6-07bd1579dd05';

DELETE FROM public.brands WHERE id = 'd78e0cbf-57d0-45bf-b8d6-07bd1579dd05';

-- Now add normalized_name column
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS normalized_name text;
UPDATE public.brands SET normalized_name = lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) WHERE normalized_name IS NULL;
ALTER TABLE public.brands ALTER COLUMN normalized_name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS brands_normalized_name_unique ON public.brands (normalized_name);

-- Add external_id to brand_locations
ALTER TABLE public.brand_locations ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS brand_locations_external_id_unique ON public.brand_locations (external_id) WHERE external_id IS NOT NULL;

-- Add lat/lng composite index
CREATE INDEX IF NOT EXISTS brand_locations_lat_lng_idx ON public.brand_locations (latitude, longitude);
