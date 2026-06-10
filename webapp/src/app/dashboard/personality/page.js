'use client';

import React, { useState, useEffect } from 'react';
import { useActiveDevice } from '@/lib/useActiveDevice';
import { Cpu, HelpCircle, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function PersonalityPage() {
  const { activeDeviceId, device, preferences, loading, error, updatePreferences } = useActiveDevice();
  
  const [preset, setPreset] = useState('playful');
  const [customPrompt, setCustomPrompt] = useState('');
  const [ttsVoice, setTtsVoice] = useState('en-US-Neural2-D');
  const [conversationTimeout, setConversationTimeout] = useState(15000);
  
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Load preferences once available
  useEffect(() => {
    if (preferences) {
      setPreset(preferences.personality_preset || 'playful');
      setCustomPrompt(preferences.personality_custom_prompt || '');
      setTtsVoice(preferences.tts_voice || 'en-US-Neural2-D');
      setConversationTimeout(preferences.conversation_timeout_ms || 15000);
    }
  }, [preferences]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError(null);

    const { error: updateErr } = await updatePreferences({
      personality_preset: preset,
      personality_custom_prompt: preset === 'custom' ? customPrompt : null,
      tts_voice: ttsVoice,
      conversation_timeout_ms: Number(conversationTimeout)
    });

    setSaveLoading(false);
    if (updateErr) {
      setSaveError(updateErr);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const presets = [
    { id: 'playful', title: 'Playful & Witty', desc: 'Deskimon reacts with humor, jokes, and energetic expressions.', icon: '🤪' },
    { id: 'sarcastic', title: 'Sarcastic Companion', desc: 'Deskimon is slightly cynical, ironical, and spits hilarious remarks.', icon: '😏' },
    { id: 'helpful', title: 'Helpful Assistant', desc: 'Polite, straight-to-the-point, and focused on assisting you.', icon: '😇' },
    { id: 'calm', title: 'Calm & Zen', desc: 'Speaks slowly, gives mindful tips, and triggers relaxing colors.', icon: '🧘' },
    { id: 'energetic', title: 'Motivator', desc: 'Loves cheering you on, high-energy vocabulary, and fast eye motions.', icon: '⚡' },
    { id: 'custom', title: 'Fully Custom', desc: 'Write your own custom prompt instructing Deskimon how to behave.', icon: '🧠' }
  ];

  const voices = [
    { id: 'en-US-Neural2-D', label: 'English (US) — Male (Neural2)' },
    { id: 'en-US-Neural2-F', label: 'English (US) — Female (Neural2)' },
    { id: 'en-GB-Neural2-F', label: 'English (UK) — Female (Neural2)' },
    { id: 'en-IN-Wavenet-D', label: 'English (India) — Female (Wavenet)' },
    { id: 'hi-IN-Neural2-A', label: 'Hindi (India) — Female (Neural2)' }
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
          Please select a device from the list page to customize its AI brain.
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-sm">
          Go to Device List
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      
      {/* Header info */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={24} style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-display" style={{ fontSize: '28px', fontWeight: '700' }}>AI Personality Brain</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Configuring <strong style={{ color: 'var(--color-primary)' }}>{device?.device_name}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Presets Selection */}
        <div>
          <h3 className="text-display" style={{ fontSize: '18px', marginBottom: '12px' }}>Select Preset Personality</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {presets.map((p) => {
              const isSelected = preset === p.id;
              return (
                <div 
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(0, 255, 255, 0.03)' : 'var(--bg-card)',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast) ease',
                    boxShadow: isSelected ? 'var(--shadow-glow)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{p.icon}</div>
                  <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>{p.title}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom prompt text area if 'custom' is selected */}
        {preset === 'custom' && (
          <div className="animate-fade-in">
            <label className="input-label" htmlFor="custom_prompt">Custom AI System Prompt</label>
            <textarea
              id="custom_prompt"
              className="input"
              rows={4}
              placeholder="e.g. You are a helpful companion that loves programming. Explain concepts using funny programming analogies and keep your answers very short (1-2 sentences max)..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
              Define details about name, role, guidelines, constraints, and vocabulary. Keep it concise.
            </span>
          </div>
        )}

        {/* TTS voice select */}
        <div>
          <label className="input-label" htmlFor="tts_voice">Text-to-Speech (TTS) Voice</label>
          <select 
            id="tts_voice"
            className="input" 
            value={ttsVoice} 
            onChange={(e) => setTtsVoice(e.target.value)}
            style={{ 
              background: 'var(--bg-input)', 
              color: 'var(--text-primary)',
              appearance: 'none',
              cursor: 'pointer'
            }}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Timing parameters */}
        <div>
          <label className="input-label" htmlFor="timeout">Conversation Timeout (Milliseconds)</label>
          <input 
            id="timeout"
            type="number" 
            className="input" 
            value={conversationTimeout}
            onChange={(e) => setConversationTimeout(e.target.value)}
            min={5000}
            max={60000}
            step={1000}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
            The time (in ms) the device stays in continuous listening mode before returning to standby after speech ends.
          </span>
        </div>

        {/* Feedbacks and submission buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            disabled={saveLoading}
          >
            <Save size={16} />
            {saveLoading ? 'Saving...' : 'Save Configuration'}
          </button>

          {saveSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '14px', fontWeight: '500' }}>
              <CheckCircle size={16} /> Saved & Synced with Device!
            </div>
          )}

          {saveError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: '14px', fontWeight: '500' }}>
              <AlertTriangle size={16} /> {saveError}
            </div>
          )}
        </div>

      </form>
    </div>
  );
}
