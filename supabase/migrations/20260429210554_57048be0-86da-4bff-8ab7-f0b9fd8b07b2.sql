-- Bucket privado para imagens do dream board
INSERT INTO storage.buckets (id, name, public)
VALUES ('dream-board', 'dream-board', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: cada user só acessa arquivos dentro de uma pasta com seu próprio id
CREATE POLICY "Users read own dream-board files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'dream-board' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own dream-board files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dream-board' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own dream-board files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dream-board' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own dream-board files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dream-board' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Índice para acelerar load do user_data
CREATE INDEX IF NOT EXISTS idx_user_data_user_id_key ON public.user_data(user_id, key);