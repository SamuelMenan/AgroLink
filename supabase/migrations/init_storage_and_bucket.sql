-- Initialize storage system and create product-images bucket
-- This script creates the storage schema and bucket if they don't exist

-- Check if storage schema exists, if not create basic structure
CREATE SCHEMA IF NOT EXISTS storage;

-- Create buckets table if it doesn't exist
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    owner uuid,
    public boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    file_size_limit bigint,
    allowed_mime_types text[]
);

-- Create objects table if it doesn't exist  
CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id) ON DELETE CASCADE,
    name text NOT NULL,
    owner uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}',
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
    version uuid DEFAULT gen_random_uuid(),
    CONSTRAINT objects_bucket_id_name_key UNIQUE(bucket_id, name)
);

-- Create the product-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT ALL ON storage.buckets TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;

-- Enable RLS
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images' AND auth.role() = 'anon');

CREATE POLICY "Allow authenticated users to upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow users to update their own images" ON storage.objects
FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Allow users to delete their own images" ON storage.objects
FOR DELETE USING (bucket_id = 'product-images' AND auth.uid() = owner);