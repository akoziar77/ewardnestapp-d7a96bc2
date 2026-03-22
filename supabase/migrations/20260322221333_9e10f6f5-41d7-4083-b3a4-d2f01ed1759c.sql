INSERT INTO public.page_access (page_key, page_label, role_name, allowed)
VALUES
  ('admin_page_directory', 'Page Directory', 'user', false),
  ('admin_page_directory', 'Page Directory', 'manager', false)
ON CONFLICT DO NOTHING;