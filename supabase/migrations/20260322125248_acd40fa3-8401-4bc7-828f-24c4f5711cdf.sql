
CREATE TABLE public.brand_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line text,
  latitude double precision,
  longitude double precision,
  geofence_radius_meters integer NOT NULL DEFAULT 200,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'US',
  phone text,
  is_headquarters boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brand locations"
  ON public.brand_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_brand_locations_brand_id ON public.brand_locations(brand_id);
CREATE INDEX idx_brand_locations_coords ON public.brand_locations(latitude, longitude) WHERE latitude IS NOT NULL;
