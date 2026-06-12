-- ============================================================
-- DESKIMON — Migration: Disable RLS on Device Preferences
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Disable Row Level Security on device_preferences to ensure the ESP32 (which connects anonymously) 
-- can reliably receive Realtime WebSocket update notifications.
ALTER TABLE public.device_preferences DISABLE ROW LEVEL SECURITY;
