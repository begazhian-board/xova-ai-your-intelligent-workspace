CREATE POLICY "Users upload own xova images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'xova-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);