'use client';

import React from 'react';
import { useActiveDevice } from '@/lib/useActiveDevice';
import { Wifi, HelpCircle, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function NetworkPage() {
  const { activeDeviceId, device, loading, refresh } = useActiveDevice();

  const getSignalIconColor = (rssi) => {
    if (!rssi) return 'var(--text-tertiary)';
    if (rssi >= -60) return 'var(--color-success)';
    if (rssi >= -80) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const getSignalStrengthPercentage = (rssi) => {
    if (!rssi) return 0;
    // Maps -100dBm to 0% and -40dBm to 100%
    const pct = Math.round(((rssi + 100) / 60) * 100);
    return Math.min(Math.max(pct, 0), 100);
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
          Please select a device from the list page to view its Wi-Fi status.
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
            <Wifi size={24} style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-display" style={{ fontSize: '28px', fontWeight: '700' }}>Network Settings</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Monitoring connection for <strong style={{ color: 'var(--color-primary)' }}>{device?.device_name}</strong>
          </p>
        </div>
        
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={refresh}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={12} /> Refresh Link
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Connection Status Card */}
        <div className="card" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: getSignalIconColor(device?.wifi_signal_strength)
          }}>
            <Wifi size={32} />
          </div>

          <div style={{ flex: 1 }}>
            <h3 className="text-display" style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {device?.is_online ? 'Connected to Internet' : 'Device Offline'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {device?.is_online ? `Active Network SSID: "${device?.wifi_ssid || 'Unknown'}"` : 'Your device is not communicating with the cloud. Check power.'}
            </p>
          </div>

          {device?.is_online && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: getSignalIconColor(device?.wifi_signal_strength) }}>
                {getSignalStrengthPercentage(device?.wifi_signal_strength)}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
                RSSI: {device?.wifi_signal_strength || -100} dBm
              </div>
            </div>
          )}
        </div>

        {/* Reconfigure Info Alert */}
        <div className="card card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-primary)' }}>
            <AlertCircle size={20} />
            <h4 className="text-display" style={{ fontSize: '16px' }}>Need to Connect to a New Wi-Fi?</h4>
          </div>
          
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            If you moved your physical DESKIMON to a new location, or changed your home network SSID/password, you can configure new settings via the offline setup wizard:
          </p>

          <ol style={{ paddingLeft: '20px', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>
              Turn off your DESKIMON, then hold the <strong>PWR / Boot Key</strong> while powering it back on.
            </li>
            <li>
              Release the button when the display says <strong>&quot;AP Mode: DESKIMON-Setup&quot;</strong>.
            </li>
            <li>
              On your phone or laptop, connect to the Wi-Fi network named <strong>DESKIMON-Setup</strong> (no password required).
            </li>
            <li>
              A portal setup screen should open automatically. If it doesn&apos;t, open your browser and navigate to <strong>http://192.168.4.1</strong>.
            </li>
            <li>
              Scan networks, enter the new password, and click <strong>Save & Reboot</strong>.
            </li>
          </ol>

          <div style={{ 
            marginTop: '8px', 
            padding: '12px', 
            borderRadius: '8px', 
            background: 'rgba(0, 255, 255, 0.03)', 
            border: '1px solid rgba(0, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            color: 'var(--text-secondary)'
          }}>
            <Smartphone size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span>The offline portal allows you to provision Wi-Fi details securely without sending passwords to the cloud.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
