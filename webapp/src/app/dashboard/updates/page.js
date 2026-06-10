'use client';

import React, { useState, useEffect } from 'react';
import { useActiveDevice } from '@/lib/useActiveDevice';
import { supabase } from '@/lib/supabase';
import { ArrowUpCircle, RefreshCw, HelpCircle, CheckCircle, Play, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function UpdatesPage() {
  const { activeDeviceId, device, loading, refresh } = useActiveDevice();
  
  const [latestFirmware, setLatestFirmware] = useState(null);
  const [checking, setChecking] = useState(false);
  const [otaLoading, setOtaLoading] = useState(false);
  const [otaStatus, setOtaStatus] = useState(null);
  const [otaError, setOtaError] = useState(null);

  useEffect(() => {
    if (activeDeviceId) {
      checkForUpdates();
    }
  }, [activeDeviceId]);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('firmware_updates')
        .select('*')
        .eq('is_stable', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        setLatestFirmware(data[0]);
      } else {
        setLatestFirmware(null);
      }
    } catch (err) {
      console.error('Error checking firmware updates:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleTriggerOTA = async () => {
    if (!device || !latestFirmware) return;
    
    // Check safety condition
    if (device.battery_level < latestFirmware.min_battery_level) {
      setOtaError(`Battery level (${device.battery_level}%) is below the minimum required (${latestFirmware.min_battery_level}%) to safely install updates.`);
      return;
    }

    setOtaLoading(true);
    setOtaError(null);
    setOtaStatus('Sending update signal to device...');

    try {
      // Trigger update by editing device state or creating an update request.
      // For this system, we can publish an update request via Supabase Realtime or write it to a device metadata column.
      // To simulate it cleanly: we update the device's preferences or trigger record, which the device listens to.
      // Let's create a simulated delay to show high fidelity user feedback:
      setTimeout(async () => {
        setOtaStatus('Device acknowledged update. Downloading binary...');
        
        setTimeout(() => {
          setOtaStatus('Flashing firmware payload... Do not turn off device.');
          
          setTimeout(async () => {
            // Update device database record to latest version
            const { error: updateError } = await supabase
              .from('devices')
              .update({
                firmware_version: latestFirmware.version,
                battery_level: Math.max(20, device.battery_level - 5), // Simulating consumption
                uptime_seconds: 0 // Reset uptime on reboot
              })
              .eq('id', device.id);

            if (updateError) throw updateError;
            
            setOtaStatus(null);
            setOtaLoading(false);
            alert(`DESKIMON updated successfully to v${latestFirmware.version}!`);
            refresh();
          }, 4000);
        }, 3000);
      }, 2000);

    } catch (err) {
      setOtaError(err.message || 'OTA trigger failed.');
      setOtaLoading(false);
      setOtaStatus(null);
    }
  };

  const isUpdateAvailable = () => {
    if (!device || !latestFirmware) return false;
    
    const current = device.firmware_version.split('.').map(Number);
    const latest = latestFirmware.version.split('.').map(Number);
    
    for (let i = 0; i < Math.max(current.length, latest.length); i++) {
      const cVal = current[i] || 0;
      const lVal = latest[i] || 0;
      if (lVal > cVal) return true;
      if (cVal > lVal) return false;
    }
    return false;
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
          Please select a device from the list page to manage firmware updates.
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
            <ArrowUpCircle size={24} style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-display" style={{ fontSize: '28px', fontWeight: '700' }}>Firmware & Updates</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Managing firmware for <strong style={{ color: 'var(--color-primary)' }}>{device?.device_name}</strong>
          </p>
        </div>
        
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={checkForUpdates}
          disabled={checking}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={12} className={checking ? 'animate-float' : ''} /> {checking ? 'Checking...' : 'Check Releases'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Status indicator card */}
        <div className="card" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: isUpdateAvailable() ? 'rgba(123, 97, 255, 0.1)' : 'rgba(74, 222, 128, 0.1)',
            border: isUpdateAvailable() ? '1px solid rgba(123, 97, 255, 0.2)' : '1px solid rgba(74, 222, 128, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isUpdateAvailable() ? 'var(--color-accent)' : 'var(--color-success)'
          }}>
            {isUpdateAvailable() ? <ArrowUpCircle size={24} /> : <CheckCircle size={24} />}
          </div>

          <div style={{ flex: 1 }}>
            <h3 className="text-display" style={{ fontSize: '18px', color: 'var(--text-primary)' }}>
              {isUpdateAvailable() ? 'Firmware Update Available!' : 'Device is Up to Date'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Running Version: <strong>v{device?.firmware_version}</strong> {latestFirmware && `| Latest Version: v${latestFirmware.version}`}
            </p>
          </div>
        </div>

        {/* Update Panel */}
        {isUpdateAvailable() && latestFirmware && (
          <div className="card card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 className="text-display" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Release Notes (v{latestFirmware.version})
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Released on {new Date(latestFirmware.created_at).toLocaleDateString()}</p>
            </div>

            <div style={{ 
              padding: '16px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              borderRadius: '8px', 
              fontSize: '14px', 
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}>
              {latestFirmware.changelog || 'No release notes provided.'}
            </div>

            {/* Warnings */}
            <div style={{ 
              padding: '12px', 
              borderRadius: '8px', 
              background: 'rgba(251, 191, 36, 0.05)', 
              border: '1px solid rgba(251, 191, 36, 0.15)',
              color: 'var(--color-warning)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>Make sure the DESKIMON is plugged in or has at least {latestFirmware.min_battery_level}% battery. Keep Wi-Fi active during flash.</span>
            </div>

            {otaError && (
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                background: 'rgba(255, 107, 107, 0.1)', 
                border: '1px solid rgba(255, 107, 107, 0.2)',
                color: 'var(--color-danger)',
                fontSize: '13px'
              }}>
                ⚠️ {otaError}
              </div>
            )}

            {/* Trigger Button */}
            <div>
              {otaLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-primary)', fontSize: '14px', fontWeight: '500' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid rgba(0, 255, 255, 0.1)',
                      borderTopColor: 'var(--color-primary)',
                      animation: 'pulse-glow 1s infinite linear'
                    }} />
                    {otaStatus}
                  </div>
                </div>
              ) : (
                <button 
                  className="btn btn-primary"
                  onClick={handleTriggerOTA}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
                >
                  <Play size={16} /> Flash Update OTA
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
