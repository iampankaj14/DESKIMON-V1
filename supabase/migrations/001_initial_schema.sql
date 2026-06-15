-- ============================================================
-- DESKIMON — Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up your database
-- ============================================================

-- 1. USER PROFILES (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'Deskimon Owner',
    avatar_url TEXT,
    -- AI preferences
    ai_provider TEXT NOT NULL DEFAULT 'default' CHECK (ai_provider IN ('default', 'openai', 'gemini', 'claude')),
    ai_api_key_encrypted TEXT,  -- User's own API key (BYOK), encrypted at rest
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. DEVICES (each physical DESKIMON unit)
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Hardware identity
    hardware_id TEXT NOT NULL UNIQUE,  -- ESP32 MAC address / eFuse ID
    device_name TEXT NOT NULL DEFAULT 'My Deskimon',
    -- Status
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    is_listening BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    firmware_version TEXT,
    wifi_ssid TEXT,
    wifi_signal_strength INTEGER,  -- RSSI in dBm
    battery_level INTEGER,  -- 0-100%
    uptime_seconds BIGINT DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. DEVICE PREFERENCES (customization per device)
CREATE TABLE IF NOT EXISTS public.device_preferences (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    -- Personality
    personality_preset TEXT NOT NULL DEFAULT 'playful' 
        CHECK (personality_preset IN ('playful', 'sarcastic', 'helpful', 'calm', 'energetic', 'custom')),
    personality_custom_prompt TEXT,  -- Custom system prompt for AI
    -- Appearance
    eye_color TEXT NOT NULL DEFAULT '#00FFFF',
    brightness INTEGER NOT NULL DEFAULT 80 CHECK (brightness BETWEEN 0 AND 100),
    -- Audio
    volume INTEGER NOT NULL DEFAULT 70 CHECK (volume BETWEEN 0 AND 100),
    tts_voice TEXT NOT NULL DEFAULT 'en-US-Neural2-D',  -- Google TTS voice ID
    audio_url TEXT,  -- URL to response speech MP3
    -- Behavior
    conversation_timeout_ms INTEGER NOT NULL DEFAULT 15000,
    sleep_after_idle_ms INTEGER NOT NULL DEFAULT 30000,
    wake_word TEXT NOT NULL DEFAULT 'Hey Spark',
    -- Timestamps
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INTERACTION LOG (analytics, optional)
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    -- Interaction data
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('voice', 'touch', 'gesture', 'motion', 'command')),
    user_input TEXT,        -- What the user said/did
    ai_response TEXT,       -- What DESKIMON replied
    emotion_triggered TEXT, -- Which eye state was triggered
    latency_ms INTEGER,     -- Total response time
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. OTA FIRMWARE UPDATES
CREATE TABLE IF NOT EXISTS public.firmware_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    changelog TEXT,
    firmware_url TEXT NOT NULL,
    checksum TEXT NOT NULL,
    is_stable BOOLEAN NOT NULL DEFAULT FALSE,
    min_battery_level INTEGER NOT NULL DEFAULT 30,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_devices_owner ON public.devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_devices_hardware ON public.devices(hardware_id);
CREATE INDEX IF NOT EXISTS idx_interactions_device ON public.interactions(device_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON public.interactions(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Users can only see their own data
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firmware_updates ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Devices: users can manage their own devices
CREATE POLICY "Users can view own devices" ON public.devices
    FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own devices" ON public.devices
    FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own devices" ON public.devices
    FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own devices" ON public.devices
    FOR DELETE USING (owner_id = auth.uid());

-- Device preferences: users can manage preferences for their devices
CREATE POLICY "Users can view own device preferences" ON public.device_preferences
    FOR SELECT USING (
        device_id IN (SELECT id FROM public.devices WHERE owner_id = auth.uid())
    );
CREATE POLICY "Users can update own device preferences" ON public.device_preferences
    FOR UPDATE USING (
        device_id IN (SELECT id FROM public.devices WHERE owner_id = auth.uid())
    );
CREATE POLICY "Users can insert own device preferences" ON public.device_preferences
    FOR INSERT WITH CHECK (
        device_id IN (SELECT id FROM public.devices WHERE owner_id = auth.uid())
    );

-- Interactions: users can view interactions for their devices
CREATE POLICY "Users can view own interactions" ON public.interactions
    FOR SELECT USING (
        device_id IN (SELECT id FROM public.devices WHERE owner_id = auth.uid())
    );

-- Firmware updates: everyone can read (public info)
CREATE POLICY "Anyone can view firmware updates" ON public.firmware_updates
    FOR SELECT USING (true);

-- ============================================================
-- AUTO-UPDATE timestamps trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER device_preferences_updated_at
    BEFORE UPDATE ON public.device_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'Deskimon Owner')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
