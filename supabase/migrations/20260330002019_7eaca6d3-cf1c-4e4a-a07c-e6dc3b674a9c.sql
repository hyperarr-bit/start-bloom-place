-- Remove the public anonymous access policy on skin-photos
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'skin-photos';