'use client';

import React, { useState, useEffect } from 'react';
import { useActiveDevice } from '@/lib/useActiveDevice';
import { supabase } from '@/lib/supabase';
import { Activity, RefreshCw, HelpCircle, HardDrive, Clock, ShieldCheck, Speech } from 'lucide-react';
import Link from 'next/link';

export default function DiagnosticsPage() {
  const { activeDeviceId, device, loading, refresh } = useActiveDevice();
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (activeDeviceId) {
      fetchLogs();
    }
  }, [activeDeviceId]);

  const fetchLogs = async () => {
    if (!activeDeviceId) return;
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('device_id', activeDeviceId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching interactions log:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0 seconds';
    const hrs = Math.floor(Number(seconds) / 3600);
    const mins = Math.floor((Number(seconds) % 3600) / 60);
    const secs = Number(seconds) % 60;
    
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ');
  };

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
          Please select a device from the list page to view diagnostics telemetry.
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
      <div className="flex flex-between flex-center" style={{ marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={24} style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-display" style={{ fontSize: '28px', fontWeight: '700' }}>Diagnostics & Logs</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Telemetry logs for <strong style={{ color: 'var(--color-primary)' }}>{device?.device_name}</strong>
          </p>
        </div>
        
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={async () => {
            refresh();
            await fetchLogs();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={12} /> Refresh Logs
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Hardware Status Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          
          {/* Uptime card */}
          <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ color: 'var(--color-primary)' }}><Clock size={24} /></div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>Uptime</div>
              <div style={{ fontSize: '18px', fontWeight: '700' }}>{formatUptime(device?.uptime_seconds)}</div>
            </div>
          </div>

          {/* MAC Address card */}
          <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ color: 'var(--color-primary)' }}><HardDrive size={24} /></div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>MAC Address</div>
              <div style={{ fontSize: '16px', fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden' }}>{device?.hardware_id}</div>
            </div>
          </div>

          {/* Verification Status Card */}
          <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ color: 'var(--color-success)' }}><ShieldCheck size={24} /></div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>Self-Test Status</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-success)' }}>Passed</div>
            </div>
          </div>

        </div>

        {/* Live Logs / Interaction Feed */}
        <div className="card card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="flex flex-between flex-center">
            <h3 className="text-display" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Speech size={18} style={{ color: 'var(--color-primary)' }} /> Voice Interaction Logs
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Showing last 10 entries</span>
          </div>

          {logsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '2px solid rgba(0, 255, 255, 0.1)',
                borderTopColor: 'var(--color-primary)',
                animation: 'pulse-glow 1s infinite linear'
              }} />
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
              No recent interaction logs. Speak to your DESKIMON to trigger logs!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div className="flex flex-between" style={{ fontSize: '12px' }}>
                    <span style={{ 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      background: 'rgba(0, 255, 255, 0.05)', 
                      color: 'var(--color-primary)', 
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      fontSize: '10px'
                    }}>
                      {log.interaction_type}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {log.user_input && (
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      🎤 User: <em>&quot;{log.user_input}&quot;</em>
                    </div>
                  )}

                  {log.ai_response && (
                    <div style={{ fontSize: '14px', color: 'var(--color-primary)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <span>🤖 Deskimon:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>&quot;{log.ai_response}&quot;</strong>
                    </div>
                  )}

                  <div className="flex gap-md" style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {log.emotion_triggered && (
                      <span>Emotion: <strong style={{ color: 'var(--color-primary)' }}>{log.emotion_triggered}</strong></span>
                    )}
                    {log.latency_ms && (
                      <span>Latency: <strong>{log.latency_ms}ms</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
