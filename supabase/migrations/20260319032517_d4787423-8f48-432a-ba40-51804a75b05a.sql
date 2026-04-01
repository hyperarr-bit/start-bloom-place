
INSERT INTO storage.buckets (id, name, public) VALUES ('skin-photos', 'skin-photos', true);

CREATE POLICY "Users can upload skin photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'skin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view skin photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'skin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete skin photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'skin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view skin photos" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'skin-photos');
