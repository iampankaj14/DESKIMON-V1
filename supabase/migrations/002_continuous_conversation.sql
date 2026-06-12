-- ============================================================
-- DESKIMON — Migration: Add Continuous Conversation Support
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add voice_query_url to devices table (may already exist from runtime usage)
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS voice_query_url TEXT;

-- 2. Add conversation_active flag for dashboard real-time status
--    TRUE when device is in an active multi-turn conversation
--    FALSE when in wake word detection (IDLE) mode
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS conversation_active BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Add conversation_turn_count for analytics
--    Tracks how many turns occurred in the current/last conversation session
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS conversation_turn_count INTEGER NOT NULL DEFAULT 0;
