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
  const [activeExpr, setActiveExpr] = useState('neutral');

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
          
          <style dangerouslySetInnerHTML={{ __html: `
            .preview-eye-container {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px; /* Scaled down gap */
              width: 100%;
              height: 100%;
              position: relative;
            }
            .preview-eye-wrapper {
              position: relative;
              width: 50px;
              height: 82px;
              transform-origin: center center;
              transition: transform 0.15s ease-in-out;
            }
            .preview-eye {
              width: 100%;
              height: 100%;
              border-radius: 25px;
              background: radial-gradient(circle at center, var(--eye-color) 20%, var(--eye-color) 100%);
              position: absolute;
              top: 0; left: 0;
              transition: all 0.3s ease-in-out;
              transform-origin: center center;
              overflow: hidden;
              box-shadow: 0 0 15px var(--eye-glow);
            }
            .preview-eyelid-top {
              position: absolute;
              top: 0; left: 0;
              width: 100%; height: 75px;
              background-color: #000000;
              transform: translateY(-75px);
              transition: transform 0.3s ease-in-out;
              z-index: 5;
            }
            .preview-eyelid-moon {
              position: absolute;
              bottom: 0; left: 50%;
              width: 75px; height: 82px;
              border-radius: 50%;
              background-color: #000000;
              transform: translate(-50%, 82px);
              transition: transform 0.3s ease-in-out;
              z-index: 5;
            }
            .preview-tear {
              position: absolute;
              top: 75px; left: 50%;
              transform: translateX(-50%);
              width: 18px; height: 0;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              border-radius: 0 0 9px 9px;
              opacity: 0;
              transition: height 0.3s ease, opacity 0.3s ease;
              z-index: 3;
            }
            .preview-eye-insecure {
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) scale(0);
              width: 55px; height: 55px;
              border-radius: 50%;
              background-color: var(--eye-color);
              box-shadow: 0 0 15px var(--eye-glow);
              opacity: 0;
              transition: opacity 0.3s ease, transform 0.3s ease;
              z-index: 4;
            }
            .preview-eye-wrapper.left .preview-eye-insecure {
              clip-path: polygon(0 0, 100% 0, 100% 40%, 0 75%);
            }
            .preview-eye-wrapper.right .preview-eye-insecure {
              clip-path: polygon(0 0, 100% 0, 100% 75%, 0 40%);
            }
            .preview-eye-insecure::after {
              content: '';
              position: absolute;
              height: 8px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              border-radius: 4px;
              width: 120%;
              left: -10%;
            }
            .preview-eye-wrapper.left .preview-eye-insecure::after {
              bottom: 25%;
              transform: rotate(20deg);
            }
            .preview-eye-wrapper.right .preview-eye-insecure::after {
              bottom: 25%;
              transform: rotate(-20deg);
            }
            .preview-eye-closed {
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) scale(0);
              width: 40px; height: 50px;
              opacity: 0;
              transition: opacity 0.3s ease, transform 0.3s ease;
              z-index: 4;
            }
            .preview-eye-wrapper.left .preview-eye-closed::before,
            .preview-eye-wrapper.left .preview-eye-closed::after {
              content: '';
              position: absolute;
              left: 0; width: 40px; height: 7px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              border-radius: 3.5px;
            }
            .preview-eye-wrapper.left .preview-eye-closed::before {
              top: 12px; transform: rotate(32deg); transform-origin: left center;
            }
            .preview-eye-wrapper.left .preview-eye-closed::after {
              bottom: 12px; transform: rotate(-32deg); transform-origin: left center;
            }
            .preview-eye-wrapper.right .preview-eye-closed::before,
            .preview-eye-wrapper.right .preview-eye-closed::after {
              content: '';
              position: absolute;
              right: 0; width: 40px; height: 7px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              border-radius: 3.5px;
            }
            .preview-eye-wrapper.right .preview-eye-closed::before {
              top: 12px; transform: rotate(-32deg); transform-origin: right center;
            }
            .preview-eye-wrapper.right .preview-eye-closed::after {
              bottom: 12px; transform: rotate(32deg); transform-origin: right center;
            }
            .preview-ignore-line {
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) scale(0);
              width: 60px; height: 10px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              border-radius: 5px;
              opacity: 0;
              transition: opacity 0.3s ease, transform 0.3s ease;
              z-index: 4;
            }
            .preview-ignore-hemi {
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) scale(0);
              width: 30px; height: 15px;
              border-radius: 0 0 15px 15px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              opacity: 0;
              transition: opacity 0.3s ease, transform 0.3s ease;
              z-index: 4;
            }
            .preview-eye-wrapper.left .preview-ignore-hemi {
              transform: translate(-45px, 7px) scale(0);
            }
            .preview-eye-wrapper.right .preview-ignore-hemi {
              transform: translate(15px, 7px) scale(0);
            }
            .preview-laugh-hemi {
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) scale(0);
              width: 15px; height: 7.5px;
              border-radius: 0 0 7.5px 7.5px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              opacity: 0;
              transition: opacity 0.3s ease, transform 0.3s ease;
              z-index: 4;
            }
            .preview-mouth-container {
              position: absolute;
              bottom: 22px; left: 50%;
              transform: translateX(-50%);
              width: 80px; height: 40px;
              display: flex;
              justify-content: center;
              align-items: center;
              pointer-events: none;
              z-index: 3;
            }
            .preview-mouth-arc {
              position: absolute;
              width: 20px; height: 10px;
              border: 4px solid var(--eye-color);
              border-top: none;
              border-radius: 0 0 10px 10px;
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-arc.left { left: 7px; }
            .preview-mouth-arc.right { right: 7px; }
            .preview-mouth-interest {
              position: absolute;
              width: 25px; height: 12.5px;
              border: 5px solid var(--eye-color);
              border-top: none;
              border-radius: 0 0 12.5px 12.5px;
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-interest.left { left: 5px; }
            .preview-mouth-interest.right { right: 5px; }
            .preview-mouth-ooh {
              position: absolute;
              width: 18px; height: 18px;
              border-radius: 50%;
              border: 4px solid var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-wtf {
              position: absolute;
              width: 20px; height: 15px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-wtf-circle {
              position: absolute;
              width: 18px; height: 18px;
              border-radius: 50%;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-yawn {
              position: absolute;
              width: 25px; height: 35px;
              border-radius: 12.5px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-insecure {
              position: absolute;
              width: 20px; height: 20px;
              border-radius: 50%;
              background-color: #FF0000;
              box-shadow: 0 0 8px rgba(255, 0, 0, 0.5);
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-triangle {
              position: absolute;
              width: 25px; height: 15px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .preview-mouth-laugh {
              position: absolute;
              width: 70px; height: 35px;
              border-radius: 17.5px;
              background-color: var(--eye-color);
              box-shadow: 0 0 10px var(--eye-glow);
              opacity: 0;
              transform: scale(0);
              transition: opacity 0.3s ease, transform 0.3s ease, height 0.3s ease;
              overflow: hidden;
            }
            .preview-tooth-gap {
              position: absolute;
              top: 0; width: 3px; height: 40px;
              background-color: #000000;
            }
            @keyframes previewJitter {
              0%, 100% { transform: translate(0, 0); }
              20% { transform: translate(-3px, 1px); }
              40% { transform: translate(2px, -2px); }
              60% { transform: translate(-1px, -2px); }
              80% { transform: translate(3px, 1px); }
            }
            @keyframes previewClosedShake {
              0%, 100% { transform: translate(0, 0); }
              20% { transform: translate(-3px, -2px); }
              40% { transform: translate(3px, 2px); }
              60% { transform: translate(-2px, 1px); }
              80% { transform: translate(2px, -3px); }
            }
            @keyframes previewLaughBob {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-3px); }
            }
            @keyframes previewLaughMouthBob {
              0%, 100% { transform: translateY(0) scale(1); height: 35px; }
              50% { transform: translateY(2px) scale(1); height: 25px; }
            }
            @keyframes previewIgnoreBob {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(3px); }
            }
            @keyframes previewIgnoreHemiBobL {
              0%, 100% { transform: translate(-45px, 7px) scale(1) translateY(0); }
              50% { transform: translate(-45px, 7px) scale(1) translateY(3px); }
            }
            @keyframes previewIgnoreHemiBobR {
              0%, 100% { transform: translate(15px, 7px) scale(1) translateY(0); }
              50% { transform: translate(15px, 7px) scale(1) translateY(3px); }
            }
            @keyframes previewTearDripL {
              0% { height: 0; opacity: 0; transform: translateX(-50%) translateY(0); }
              10% { height: 20px; opacity: 1; transform: translateX(-50%) translateY(0); }
              80% { height: 40px; opacity: 1; transform: translateX(-50%) translateY(20px); }
              100% { height: 40px; opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
            @keyframes previewTearDripR {
              0% { height: 0; opacity: 0; transform: translateX(-50%) translateY(0); }
              10% { height: 20px; opacity: 1; transform: translateX(-50%) translateY(0); }
              80% { height: 40px; opacity: 1; transform: translateX(-50%) translateY(20px); }
              100% { height: 40px; opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
            .preview-jittering { animation: previewJitter 0.5s infinite linear; }
            .preview-shaking { animation: previewClosedShake 0.15s infinite linear; }
            .preview-bobbing-laugh { animation: previewLaughBob 0.3s infinite ease-in-out; }
            .preview-bobbing-laugh-mouth { animation: previewLaughMouthBob 0.3s infinite ease-in-out; }
            .preview-bobbing-ignore { animation: previewIgnoreBob 0.6s infinite ease-in-out; }
            .preview-bobbing-ignore-hemi-l { animation: previewIgnoreHemiBobL 0.6s infinite ease-in-out; }
            .preview-bobbing-ignore-hemi-r { animation: previewIgnoreHemiBobR 0.6s infinite ease-in-out; }
            .preview-tear-dripping-l { animation: previewTearDripL 1.2s infinite ease-in-out; }
            .preview-tear-dripping-r { animation: previewTearDripR 1.2s infinite ease-in-out; }
          ` }} />

          <div style={{
            width: '260px',
            height: '260px',
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
              pointerEvents: 'none',
              zIndex: 6
            }} />

            {/* Glowing Eyes & Mouths Container */}
            <div className="preview-eye-container" style={{
              '--eye-color': eyeColor,
              '--eye-glow': `${eyeColor}88`,
            }}>
              {/* Left Eye Wrapper */}
              <div 
                className={`preview-eye-wrapper left ${activeExpr === 'laugh' ? 'preview-bobbing-laugh' : activeExpr === 'ignore' ? 'preview-bobbing-ignore' : ''}`}
              >
                <div 
                  className={`preview-eye ${activeExpr === 'interest' || activeExpr === 'insecure' ? 'preview-jittering' : activeExpr === 'eyes_closed' ? 'preview-shaking' : ''}`}
                  style={{
                    width: (activeExpr === 'angry' || activeExpr === 'bored') ? '65px' : activeExpr === 'sleepy' ? '45px' : '50px',
                    height: (activeExpr === 'angry' || activeExpr === 'bored') ? '90px' : activeExpr === 'sleepy' ? '12px' : activeExpr === 'cry' || activeExpr === 'wtf' ? '8px' : '82px',
                    transform: activeExpr === 'sleepy' ? 'translateY(20px)' : activeExpr === 'cry' ? 'translateY(-10px)' : activeExpr === 'wtf' ? 'translateY(-22px)' : activeExpr === 'sad' ? 'rotate(-12deg)' : activeExpr === 'angry' ? 'rotate(15deg) translateY(-20px)' : activeExpr === 'bored' ? 'translateY(-20px)' : activeExpr === 'ooh' ? 'translateY(-5px) scaleY(0.8)' : activeExpr === 'chill' ? 'translateY(-25px)' : 'none',
                    backgroundColor: activeExpr === 'angry' ? '#FF0000' : activeExpr === 'sleepy' ? '#005555' : eyeColor,
                    boxShadow: activeExpr === 'angry' ? '0 0 15px #FF0000' : activeExpr === 'sleepy' ? '0 0 8px #005555' : `0 0 15px ${eyeColor}`,
                    opacity: ['interest', 'ignore', 'insecure'].includes(activeExpr) ? 0 : 1
                  }}
                >
                  <div 
                    className="preview-eyelid-top"
                    style={{
                      transform: (activeExpr === 'angry' || activeExpr === 'bored') ? 'translateY(-20px)' : activeExpr === 'chill' ? 'translateY(-25px)' : 'translateY(-75px)'
                    }}
                  />
                  <div 
                    className="preview-eyelid-moon"
                    style={{
                      transform: (activeExpr === 'happy' || activeExpr === 'blush') ? 'translate(-50%, 20px)' : 'translate(-50%, 82px)'
                    }}
                  />
                </div>
                
                <div 
                  className={`preview-tear ${activeExpr === 'cry' ? 'preview-tear-dripping-l' : ''}`}
                  style={{
                    opacity: activeExpr === 'cry' ? 1 : 0
                  }}
                />
                
                <div 
                  className={`preview-eye-insecure ${activeExpr === 'interest' || activeExpr === 'insecure' ? 'preview-jittering' : ''}`}
                  style={{
                    transform: activeExpr === 'interest' || activeExpr === 'insecure' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
                    opacity: activeExpr === 'interest' || activeExpr === 'insecure' ? 1 : 0,
                    backgroundColor: activeExpr === 'insecure' ? '#FF0000' : eyeColor,
                    boxShadow: activeExpr === 'insecure' ? '0 0 15px #FF0000' : `0 0 15px ${eyeColor}`
                  }}
                />

                <div 
                  className="preview-eye-closed"
                  style={{
                    transform: activeExpr === 'eyes_closed' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
                    opacity: activeExpr === 'eyes_closed' ? 1 : 0
                  }}
                />
                
                <div 
                  className="preview-ignore-line"
                  style={{
                    transform: activeExpr === 'ignore' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
                    opacity: activeExpr === 'ignore' ? 1 : 0
                  }}
                />
                
                <div 
                  className={`preview-ignore-hemi ${activeExpr === 'ignore' ? 'preview-bobbing-ignore-hemi-l' : ''}`}
                  style={{
                    transform: activeExpr === 'ignore' ? 'translate(-45px, 7px) scale(1)' : 'translate(-45px, 7px) scale(0)',
                    opacity: activeExpr === 'ignore' ? 1 : 0
                  }}
                />
                
                <div 
                  className="preview-laugh-hemi"
                  style={{
                    transform: activeExpr === 'laugh' ? 'translate(-50%, -16px) scale(1)' : 'translate(-50%, -16px) scale(0)',
                    opacity: activeExpr === 'laugh' ? 1 : 0
                  }}
                />
              </div>

              {/* Right Eye Wrapper */}
              <div 
                className={`preview-eye-wrapper right ${activeExpr === 'laugh' ? 'preview-bobbing-laugh' : activeExpr === 'ignore' ? 'preview-bobbing-ignore' : ''}`}
              >
                <div 
                  className={`preview-eye ${activeExpr === 'interest' || activeExpr === 'insecure' ? 'preview-jittering' : activeExpr === 'eyes_closed' ? 'preview-shaking' : ''}`}
                  style={{
                    width: (activeExpr === 'angry' || activeExpr === 'bored') ? '65px' : activeExpr === 'sleepy' ? '45px' : '50px',
                    height: (activeExpr === 'angry' || activeExpr === 'bored') ? '90px' : activeExpr === 'sleepy' ? '12px' : activeExpr === 'cry' || activeExpr === 'wtf' ? '8px' : '82px',
                    transform: activeExpr === 'sleepy' ? 'translateY(20px)' : activeExpr === 'cry' ? 'translateY(-10px)' : activeExpr === 'wtf' ? 'translateY(-22px)' : activeExpr === 'sad' ? 'rotate(12deg)' : activeExpr === 'angry' ? 'rotate(-15deg) translateY(-20px)' : activeExpr === 'bored' ? 'translateY(-20px)' : activeExpr === 'ooh' ? 'translateY(-5px) scaleY(0.8)' : activeExpr === 'chill' ? 'translateY(-25px)' : 'none',
                    backgroundColor: activeExpr === 'angry' ? '#FF0000' : activeExpr === 'sleepy' ? '#005555' : eyeColor,
                    boxShadow: activeExpr === 'angry' ? '0 0 15px #FF0000' : activeExpr === 'sleepy' ? '0 0 8px #005555' : `0 0 15px ${eyeColor}`,
                    opacity: ['interest', 'ignore', 'insecure'].includes(activeExpr) ? 0 : 1
                  }}
                >
                  <div 
                    className="preview-eyelid-top"
                    style={{
                      transform: (activeExpr === 'angry' || activeExpr === 'bored') ? 'translateY(-20px)' : activeExpr === 'chill' ? 'translateY(-25px)' : 'translateY(-75px)'
                    }}
                  />
                  <div 
                    className="preview-eyelid-moon"
                    style={{
                      transform: (activeExpr === 'happy' || activeExpr === 'blush') ? 'translate(-50%, 20px)' : 'translate(-50%, 82px)'
                    }}
                  />
                </div>
                
                <div 
                  className={`preview-tear ${activeExpr === 'cry' ? 'preview-tear-dripping-r' : ''}`}
                  style={{
                    opacity: activeExpr === 'cry' ? 1 : 0
                  }}
                />
                
                <div 
                  className={`preview-eye-insecure ${activeExpr === 'interest' || activeExpr === 'insecure' ? 'preview-jittering' : ''}`}
                  style={{
                    transform: activeExpr === 'interest' || activeExpr === 'insecure' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
                    opacity: activeExpr === 'interest' || activeExpr === 'insecure' ? 1 : 0,
                    backgroundColor: activeExpr === 'insecure' ? '#FF0000' : eyeColor,
                    boxShadow: activeExpr === 'insecure' ? '0 0 15px #FF0000' : `0 0 15px ${eyeColor}`
                  }}
                />

                <div 
                  className="preview-eye-closed"
                  style={{
                    transform: activeExpr === 'eyes_closed' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
                    opacity: activeExpr === 'eyes_closed' ? 1 : 0
                  }}
                />
                
                <div 
                  className="preview-ignore-line"
                  style={{
                    transform: activeExpr === 'ignore' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
                    opacity: activeExpr === 'ignore' ? 1 : 0
                  }}
                />
                
                <div 
                  className={`preview-ignore-hemi ${activeExpr === 'ignore' ? 'preview-bobbing-ignore-hemi-r' : ''}`}
                  style={{
                    transform: activeExpr === 'ignore' ? 'translate(15px, 7px) scale(1)' : 'translate(15px, 7px) scale(0)',
                    opacity: activeExpr === 'ignore' ? 1 : 0
                  }}
                />
                
                <div 
                  className="preview-laugh-hemi"
                  style={{
                    transform: activeExpr === 'laugh' ? 'translate(-50%, -16px) scale(1)' : 'translate(-50%, -16px) scale(0)',
                    opacity: activeExpr === 'laugh' ? 1 : 0
                  }}
                />
              </div>

              {/* Mouth elements */}
              <div className="preview-mouth-container">
                <div 
                  className={`preview-mouth-arc left ${activeExpr === 'blush' || activeExpr === 'chill' ? 'active' : ''}`}
                  style={{
                    opacity: activeExpr === 'blush' || activeExpr === 'chill' ? 1 : 0,
                    transform: activeExpr === 'blush' || activeExpr === 'chill' ? 'translateY(10px) scale(1)' : 'translateY(10px) scale(0)'
                  }}
                />
                <div 
                  className={`preview-mouth-arc right ${activeExpr === 'blush' || activeExpr === 'chill' ? 'active' : ''}`}
                  style={{
                    opacity: activeExpr === 'blush' || activeExpr === 'chill' ? 1 : 0,
                    transform: activeExpr === 'blush' || activeExpr === 'chill' ? 'translateY(10px) scale(1)' : 'translateY(10px) scale(0)'
                  }}
                />
                <div 
                  className={`preview-mouth-interest left ${activeExpr === 'interest' ? 'active' : ''}`}
                  style={{
                    opacity: activeExpr === 'interest' ? 1 : 0,
                    transform: activeExpr === 'interest' ? 'translateY(10px) scale(1)' : 'translateY(10px) scale(0)'
                  }}
                />
                <div 
                  className={`preview-mouth-interest right ${activeExpr === 'interest' ? 'active' : ''}`}
                  style={{
                    opacity: activeExpr === 'interest' ? 1 : 0,
                    transform: activeExpr === 'interest' ? 'translateY(10px) scale(1)' : 'translateY(10px) scale(0)'
                  }}
                />
                <div 
                  className="preview-mouth-ooh"
                  style={{
                    opacity: activeExpr === 'ooh' ? 1 : 0,
                    transform: activeExpr === 'ooh' ? 'scale(1)' : 'scale(0)'
                  }}
                />
                <div 
                  className="preview-mouth-wtf"
                  style={{
                    opacity: activeExpr === 'wtf' ? 1 : 0,
                    transform: activeExpr === 'wtf' ? 'scale(1)' : 'scale(0)'
                  }}
                />
                <div 
                  className="preview-mouth-yawn"
                  style={{
                    opacity: activeExpr === 'bored' || activeExpr === 'cry' ? 1 : 0,
                    transform: activeExpr === 'bored' || activeExpr === 'cry' ? 'scale(1)' : 'scale(0)'
                  }}
                />
                <div 
                  className="preview-mouth-insecure"
                  style={{
                    opacity: activeExpr === 'insecure' ? 1 : 0,
                    transform: activeExpr === 'insecure' ? 'scale(1)' : 'scale(0)'
                  }}
                />
                <div 
                  className="preview-mouth-triangle"
                  style={{
                    opacity: activeExpr === 'happy_cry' ? 1 : 0,
                    transform: activeExpr === 'happy_cry' ? 'scale(1)' : 'scale(0)'
                  }}
                />
                <div 
                  className={`preview-mouth-laugh ${activeExpr === 'laugh' ? 'preview-bobbing-laugh-mouth' : ''}`}
                  style={{
                    opacity: activeExpr === 'laugh' ? 1 : 0,
                    transform: activeExpr === 'laugh' ? 'scale(1)' : 'scale(0)'
                  }}
                >
                  <div className="preview-tooth-gap" style={{ left: '12px' }} />
                  <div className="preview-tooth-gap" style={{ left: '26px' }} />
                  <div className="preview-tooth-gap" style={{ left: '40px' }} />
                  <div className="preview-tooth-gap" style={{ left: '54px' }} />
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ width: '100%', marginTop: '8px' }}>
            <h4 style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Preview Expression
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              width: '100%',
              maxWidth: '260px',
              margin: '0 auto'
            }}>
              {['neutral', 'happy', 'angry', 'sad', 'sleepy', 'cry', 'interest', 'ooh', 'wtf', 'laugh', 'bored', 'blush', 'chill'].map(expr => (
                <button
                  key={expr}
                  type="button"
                  onClick={() => setActiveExpr(expr)}
                  style={{
                    padding: '6px 4px',
                    borderRadius: '6px',
                    background: activeExpr === expr ? 'rgba(0, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: activeExpr === expr ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                    color: activeExpr === expr ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {expr}
                </button>
              ))}
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
