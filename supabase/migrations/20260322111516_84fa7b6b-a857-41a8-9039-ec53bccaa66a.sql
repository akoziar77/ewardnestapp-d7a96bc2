
ALTER TABLE public.brands
  ADD COLUMN latitude double precision,
  ADD COLUMN longitude double precision,
  ADD COLUMN geofence_radius_meters integer NOT NULL DEFAULT 200,
  ADD COLUMN address_line text;
