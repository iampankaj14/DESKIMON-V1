import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export function useActiveDevice() {
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [device, setDevice] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActiveDeviceData = useCallback(async (deviceId) => {
    if (!deviceId) {
      setDevice(null);
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Device Stats
      const { data: devData, error: devError } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .single();

      if (devError) throw devError;
      setDevice(devData);

      // 2. Fetch Device Preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from('device_preferences')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (prefsError) throw prefsError;
      setPreferences(prefsData);
    } catch (err) {
      console.error('Error loading device stats/preferences:', err);
      setError(err.message || 'Failed to load device details.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    const savedActiveId = localStorage.getItem('deskimon_active_device_id');
    setActiveDeviceId(savedActiveId);
    fetchActiveDeviceData(savedActiveId);
  }, [fetchActiveDeviceData]);

  // Initial load and storage listener
  useEffect(() => {
    refresh();

    // Check periodically for changes in active device
    const interval = setInterval(() => {
      const savedActiveId = localStorage.getItem('deskimon_active_device_id');
      if (savedActiveId !== activeDeviceId) {
        setActiveDeviceId(savedActiveId);
        fetchActiveDeviceData(savedActiveId);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeDeviceId, fetchActiveDeviceData, refresh]);

  // Update preferences helper
  const updatePreferences = async (newPrefs) => {
    if (!activeDeviceId) return { error: 'No active device selected.' };
    
    try {
      const { data, error: updateError } = await supabase
        .from('device_preferences')
        .update({
          ...newPrefs,
          updated_at: new Date().toISOString()
        })
        .eq('device_id', activeDeviceId)
        .select()
        .single();

      if (updateError) throw updateError;
      setPreferences(data);
      return { data, error: null };
    } catch (err) {
      console.error('Error updating preferences:', err);
      return { data: null, error: err.message || 'Failed to update preferences.' };
    }
  };

  // Update device helper (e.g. name)
  const updateDevice = async (newDeviceDetails) => {
    if (!activeDeviceId) return { error: 'No active device selected.' };

    try {
      const { data, error: updateError } = await supabase
        .from('devices')
        .update({
          ...newDeviceDetails,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeDeviceId)
        .select()
        .single();

      if (updateError) throw updateError;
      setDevice(data);
      return { data, error: null };
    } catch (err) {
      console.error('Error updating device settings:', err);
      return { data: null, error: err.message || 'Failed to update device settings.' };
    }
  };

  return {
    activeDeviceId,
    device,
    preferences,
    loading,
    error,
    updatePreferences,
    updateDevice,
    refresh
  };
}
