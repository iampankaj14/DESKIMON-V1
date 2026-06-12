-- ============================================================
-- DESKIMON — Migration: Allow Public Select on Device Preferences
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Allow anonymous/public SELECT on device_preferences so that the ESP32 (which connects anonymously) 
-- can receive Realtime WebSocket update notifications when preferences change.
CREATE POLICY "Allow public select on device_preferences"
ON public.device_preferences
FOR SELECT
TO public
USING (true);
