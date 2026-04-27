CREATE POLICY "Users can update their own invoices"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);