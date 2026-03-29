
-- Create storage bucket for wallet document images/PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallet-docs', 'wallet-docs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload to their own folder
CREATE POLICY "Users can upload wallet docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wallet-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can read their own files
CREATE POLICY "Users can read own wallet docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'wallet-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can delete their own files
CREATE POLICY "Users can delete own wallet docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wallet-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
