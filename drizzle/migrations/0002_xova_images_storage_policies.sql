CREATE POLICY "Users read own xova images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'xova-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own xova images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'xova-images' AND (storage.foldername(name))[1] = auth.uid()::text);