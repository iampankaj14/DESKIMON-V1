'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  RefreshCw, 
  Cpu, 
  Battery, 
  Wifi, 
  ArrowRight, 
  Trash2,
  AlertCircle
} from 'lucide-react';

export default function DeviceListPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  
  // Registration Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [hardwareId, setHardwareId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setDevices(data || []);

      // Restore active device selection from localStorage if possible
      const savedActiveId = localStorage.getItem('deskimon_active_device_id');
      if (data && data.length > 0) {
        const foundActive = data.some(d => d.id === savedActiveId);
        const nextActiveId = foundActive ? savedActiveId : data[0].id;
        setActiveDeviceId(nextActiveId);
        localStorage.setItem('deskimon_active_device_id', nextActiveId);
      } else {
        setActiveDeviceId('');
        localStorage.removeItem('deskimon_active_device_id');
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectActive = (deviceId) => {
    setActiveDeviceId(deviceId);
    localStorage.setItem('deskimon_active_device_id', deviceId);
  };

  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      // 1. Insert device details
      const { data: newDevice, error: deviceError } = await supabase
        .from('devices')
        .insert({
          owner_id: user.id,
          hardware_id: hardwareId.trim().toUpperCase(),
          device_name: deviceName.trim() || 'My Deskimon',
          firmware_version: '1.0.0',
          battery_level: 100,
          wifi_signal_strength: -50,
          is_online: false
        })
        .select()
        .single();

      if (deviceError) throw deviceError;

      // 2. Create device preferences entry
      const { error: prefsError } = await supabase
        .from('device_preferences')
        .insert({
          device_id: newDevice.id,
          personality_preset: 'playful',
          eye_color: '#00FFFF',
          brightness: 80,
          volume: 70,
          tts_voice: 'en-US-Neural2-D',
          conversation_timeout_ms: 15000,
          sleep_after_idle_ms: 30000,
          wake_word: 'Hey Spark'
        });

      if (prefsError) throw prefsError;

      // Reset form and refresh list
      setHardwareId('');
      setDeviceName('');
      setShowAddModal(false);
      await fetchDevices();
      
      // Auto-set the newly registered device as active
      if (newDevice) {
        handleSelectActive(newDevice.id);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to register device. Check if the Hardware ID is already registered.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteDevice = async (id, name) => {
    if (!confirm(`Are you sure you want to unregister "${name}"? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchDevices();
    } catch (err) {
      alert(err.message || 'Error deleting device.');
    }
  };

  const getSignalStrengthLabel = (rssi) => {
    if (!rssi) return 'No Signal';
    if (rssi >= -50) return 'Excellent';
    if (rssi >= -70) return 'Good';
    if (rssi >= -85) return 'Fair';
    return 'Weak';
  };

  return (
    <div style={{ position: 'relative' }}>
      
      {/* Header section inside main */}
      <div className="flex flex-between flex-center" style={{ marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-display" style={{ fontSize: '28px', fontWeight: '700' }}>Your Companions</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Register, select, and manage your active DESKIMON units.
          </p>
        </div>
        
        <div className="flex gap-sm">
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={fetchDevices}
            aria-label="Refresh device list"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button 
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Link Device
          </button>
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2px solid rgba(0, 255, 255, 0.1)',
            borderTopColor: 'var(--color-primary)',
            animation: 'pulse-glow 1s infinite linear'
          }} />
        </div>
      ) : devices.length === 0 ? (
        <div className="card text-center" style={{ padding: '64px 32px', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
          <h3 className="text-display" style={{ fontSize: '20px', marginBottom: '8px' }}>No Companions Registered</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 24px', fontSize: '14px' }}>
            To get started, turn on your physical DESKIMON, read the Hardware ID (MAC Address) from its startup wizard screen, and register it below.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowAddModal(true)}
            style={{ padding: '12px 24px' }}
          >
            <Plus size={16} style={{ marginRight: '6px' }} /> Register My First DESKIMON
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {devices.map((device) => {
            const isSelected = device.id === activeDeviceId;
            
            return (
              <div 
                key={device.id} 
                className="card"
                style={{
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(0, 255, 255, 0.01)' : 'var(--bg-card)',
                  boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative'
                }}
              >
                {/* Active Indicator Pin */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(0, 255, 255, 0.1)',
                    border: '1px solid rgba(0, 255, 255, 0.2)',
                    color: 'var(--color-primary)',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}>
                    Active
                  </div>
                )}

                {/* Device Title info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: device.is_online ? 'var(--color-success)' : 'var(--text-tertiary)',
                      boxShadow: device.is_online ? '0 0 8px var(--color-success)' : 'none'
                    }} />
                    <h3 className="text-display" style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{device.device_name}</h3>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    HW ID: {device.hardware_id}
                  </div>
                </div>

                {/* Technical Stats */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '12px', 
                  padding: '12px', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  borderRadius: '8px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <Battery size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <span>Battery: <strong>{device.battery_level}%</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <Wifi size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <span>Wi-Fi: <strong>{getSignalStrengthLabel(device.wifi_signal_strength)}</strong></span>
                  </div>
                </div>

                {/* Bottom Row Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ 
                      fontSize: '12px', 
                      padding: '6px 12px',
                      borderColor: 'var(--color-danger)',
                      color: 'var(--color-danger)'
                    }}
                    onClick={() => handleDeleteDevice(device.id, device.device_name)}
                  >
                    <Trash2 size={12} /> Unlink
                  </button>

                  {!isSelected ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => handleSelectActive(device.id)}
                    >
                      Make Active
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: '600' }}>
                      Ready to manage <Cpu size={14} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Device Modal Dialog */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 5, 5, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div 
            className="card card-glass animate-fade-in" 
            style={{ 
              width: '100%', 
              maxWidth: '440px',
              padding: '32px'
            }}
          >
            <h3 className="text-display" style={{ fontSize: '20px', marginBottom: '8px' }}>Link New DESKIMON</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Connect a physical DESKIMON to your profile database using its hardware address.
            </p>

            <form onSubmit={handleRegisterDevice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label" htmlFor="hardware_id">Hardware ID / MAC Address</label>
                <input 
                  id="hardware_id"
                  type="text" 
                  className="input" 
                  placeholder="e.g. 24:0A:C4:0A:11:22" 
                  value={hardwareId}
                  onChange={(e) => setHardwareId(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                  This is shown on your device display during the setup sequence.
                </span>
              </div>

              <div>
                <label className="input-label" htmlFor="device_name">Custom Device Name</label>
                <input 
                  id="device_name"
                  type="text" 
                  className="input" 
                  placeholder="e.g. Desk Buddy" 
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  required
                />
              </div>

              {formError && (
                <div style={{ 
                  padding: '12px', 
                  borderRadius: 'var(--radius-sm)', 
                  background: 'rgba(255, 107, 107, 0.1)', 
                  border: '1px solid rgba(255, 107, 107, 0.2)',
                  color: 'var(--color-danger)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowAddModal(false)}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  disabled={formLoading}
                >
                  {formLoading ? 'Linking...' : 'Register Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
