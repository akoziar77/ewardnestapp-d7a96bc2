
-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);

-- Seed default roles
INSERT INTO public.roles(name) VALUES ('admin'), ('manager'), ('user')
ON CONFLICT (name) DO NOTHING;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL,
  role_id int NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS for roles table (everyone can read)
CREATE POLICY roles_read_all ON public.roles
  FOR SELECT TO authenticated USING (true);

-- is_admin helper function
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  );
$$;

-- RLS policies for user_roles
CREATE POLICY user_roles_read_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY user_roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY user_roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_admin());
