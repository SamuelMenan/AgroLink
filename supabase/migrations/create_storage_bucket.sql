-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

-- Grant permissions for storage operations
GRANT ALL ON storage.buckets TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;

-- Create RLS policies for storage
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images' AND auth.role() = 'anon');

CREATE POLICY "Allow authenticated users to upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow users to update their own images" ON storage.objects
FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid() = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to delete their own images" ON storage.objects
FOR DELETE USING (bucket_id = 'product-images' AND auth.uid() = (storage.foldername(name))[1]);