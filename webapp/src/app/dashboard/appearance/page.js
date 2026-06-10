'use client';

import React, { useState, useEffect } from 'react';
import { useActiveDevice } from '@/lib/useActiveDevice';
import { Palette, Sun, Volume2, HelpCircle, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AppearancePage() {
  const { activeDeviceId, device, preferences, loading, error, updatePreferences } = useActiveDevice();

  const [eyeColor, setEyeColor] = useState('#00FFFF');
  const [brightness, setBrightness] = useState(80);
  const [volume, setVolume] = useState(70);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Sync preferences once loaded
  useEffect(() => {
    if (preferences) {
      setEyeColor(preferences.eye_color || '#00FFFF');
      setBrightness(preferences.brightness || 80);
      setVolume(preferences.volume || 70);
    }
  }, [preferences]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError(null);

    const { error: updateErr } = await updatePreferences({
      eye_color: eyeColor,
      brightness: Number(brightness),
      volume: Number(volume),
    });

    setSaveLoading(false);
    if (updateErr) {
      setSaveError(updateErr);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const quickColors = [
    { name: 'Cyan Glow', hex: '#00FFFF' },
    { name: 'Volt Yellow', hex: '#ADFF2F' },
    { name: 'Hot Pink', hex: '#FF1493' },
    { name: 'Plasma Purple', hex: '#7B61FF' },
    { name: 'Lava Orange', hex: '#FF4500' },
    { name: 'Emerald Green', hex: '#00FA9A' },
  ];

  if (loading) {
    return (
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
    );
  }

  if (!activeDeviceId) {
    return (
      <div className="card text-center" style={{ padding: '48px 24px' }}>
        <HelpCircle size={40} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
        <h3 className="text-display" style={{ fontSize: '20px', marginBottom: '8px' }}>No Active Device selected</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 16px', fontSize: '14px' }}>
          Please select a device from the list page to customize its look.
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-sm">
          Go to Device List
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      
      {/* Header Info */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Palette size={24} style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-display" style={{ fontSize: '28px', fontWeight: '700' }}>Look & Feel</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Configuring <strong style={{ color: 'var(--color-primary)' }}>{device?.device_name}</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Settings Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Eye Color Selector */}
          <div>
            <h3 className="text-display" style={{ fontSize: '16px', marginBottom: '12px' }}>Eye Glow Color</h3>
            
            {/* Quick palettes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              {quickColors.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => setEyeColor(color.hex)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: eyeColor === color.hex ? `2px solid ${color.hex}` : '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast) ease'
                  }}
                >
                  <span style={{ 
                    display: 'inline-block', 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: color.hex,
                    boxShadow: `0 0 6px ${color.hex}` 
                  }} />
                  {color.name}
                </button>
              ))}
            </div>

            {/* Custom Color Input */}
            <div className="flex flex-center" style={{ gap: '12px' }}>
              <input 
                id="custom_color_picker"
                type="color" 
                value={eyeColor}
                onChange={(e) => setEyeColor(e.target.value)}
                style={{
                  width: '48px',
                  height: '42px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              />
              <input 
                id="custom_color_text"
                type="text"
                className="input"
                value={eyeColor}
                onChange={(e) => setEyeColor(e.target.value)}
                placeholder="#00FFFF"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Brightness */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="input-label" htmlFor="brightness" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                <Sun size={16} style={{ color: 'var(--text-tertiary)' }} /> Screen Brightness
              </label>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-primary)' }}>{brightness}%</span>
            </div>
            <input 
              id="brightness"
              type="range" 
              className="input" 
              value={brightness}
              onChange={(e) => setBrightness(e.target.value)}
              min="10"
              max="100"
              style={{ padding: '8px 0', cursor: 'pointer', height: '6px' }}
            />
          </div>

          {/* Speaker Volume */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="input-label" htmlFor="volume" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                <Volume2 size={16} style={{ color: 'var(--text-tertiary)' }} /> Speaker Volume
              </label>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-primary)' }}>{volume}%</span>
            </div>
            <input 
              id="volume"
              type="range" 
              className="input" 
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              min="0"
              max="100"
              style={{ padding: '8px 0', cursor: 'pointer', height: '6px' }}
            />
          </div>

          {/* Submission and triggers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              disabled={saveLoading}
            >
              <Save size={16} />
              {saveLoading ? 'Syncing...' : 'Apply Appearance'}
            </button>

            {saveSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '14px', fontWeight: '500' }}>
                <CheckCircle size={16} /> Look Synced!
              </div>
            )}

            {saveError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: '14px', fontWeight: '500' }}>
                <AlertTriangle size={16} /> {saveError}
              </div>
            )}
          </div>

        </form>

        {/* Live CSS Screen Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <h3 className="text-display" style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>Live Display Preview</h3>
          
          <div style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: '50%',
            background: '#050505',
            border: '6px solid #161616',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6), inset 0 0 10px rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            opacity: brightness / 100
          }}>
            {/* Glossy overlay */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />

            {/* Glowing Eyes */}
            <div style={{ display: 'flex', gap: '30px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: eyeColor,
                boxShadow: `0 0 20px ${eyeColor}, 0 0 40px ${eyeColor}`
              }} />
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: eyeColor,
                boxShadow: `0 0 20px ${eyeColor}, 0 0 40px ${eyeColor}`
              }} />
            </div>
          </div>
          
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Color changes will update on the physical device screen instantly.
          </span>
        </div>

      </div>
    </div>
  );
}
