-- ======================================================================
-- Run this in the Supabase SQL Editor to create the 'audio' storage bucket
-- and set up Row Level Security (RLS) policies for recording & responses.
-- ======================================================================

-- 1. Create a new public storage bucket named 'audio'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio', 
  'audio', 
  true, 
  10485760, -- 10MB limit
  '{"audio/wav", "audio/mpeg", "audio/mp3"}'
)
ON CONFLICT (id) DO NOTHING;

-- RLS is enabled on storage.objects by default in Supabase.

-- 3. Create RLS policies for the 'audio' bucket
-- Allow anyone (including anonymous/ESP32) to read files from the audio bucket
CREATE POLICY "Public Read Access to Audio Bucket"
  ON storage.objects FOR SELECT
  TO public
  USING ( bucket_id = 'audio' );

-- Allow authenticated users & ESP32 to upload voice queries and responses
CREATE POLICY "Insert Access to Audio Bucket"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK ( bucket_id = 'audio' );

-- Allow updates (like overwriting queries/responses)
CREATE POLICY "Update Access to Audio Bucket"
  ON storage.objects FOR UPDATE
  TO public
  USING ( bucket_id = 'audio' );

-- Allow deletion (for cleanup)
CREATE POLICY "Delete Access to Audio Bucket"
  ON storage.objects FOR DELETE
  TO public
  USING ( bucket_id = 'audio' );
