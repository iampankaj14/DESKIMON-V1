'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import BRANDING from '@/lib/branding';
import { 
  LayoutDashboard, 
  Cpu, 
  Palette, 
  Wifi, 
  ArrowUpCircle, 
  Activity, 
  LogOut, 
  User, 
  Menu, 
  X 
} from 'lucide-react';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Authenticate user on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // If not authenticated, redirect to login
        router.push('/login');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    };

    checkUser();

    // Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Device List', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Personality', href: '/dashboard/personality', icon: Cpu },
    { label: 'Appearance', href: '/dashboard/appearance', icon: Palette },
    { label: 'Network', href: '/dashboard/network', icon: Wifi },
    { label: 'OTA Updates', href: '/dashboard/updates', icon: ArrowUpCircle },
    { label: 'Diagnostics', href: '/dashboard/diagnostics', icon: Activity },
  ];

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(0, 255, 255, 0.1)',
            borderTopColor: 'var(--color-primary)',
            animation: 'pulse-glow 1s infinite linear'
          }} />
          <p style={{ fontSize: '14px', letterSpacing: '0.05em' }}>Authenticating Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      fontFamily: 'var(--font-body)',
      color: 'var(--text-primary)',
      overflowX: 'hidden'
    }}>
      {/* Sidebar Navigation */}
      <aside 
        style={{
          width: sidebarOpen ? '260px' : '0px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--duration-normal) var(--ease-out)',
          overflow: 'hidden',
          zIndex: 90,
          position: 'relative'
        }}
      >
        {/* Brand Banner */}
        <div style={{
          height: 'var(--nav-height)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          justifyContent: 'space-between'
        }}>
          <Link href="/dashboard" className="text-display" style={{ fontSize: '20px', fontWeight: '800', tracking: '0.05em', color: 'var(--text-primary)' }}>
            {BRANDING.name}
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)} 
            style={{ background: 'none', color: 'var(--text-secondary)', display: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-inverse)',
            fontWeight: '600'
          }}>
            <User size={16} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {user?.user_metadata?.display_name || 'Deskimon Owner'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(0, 255, 255, 0.05)' : 'transparent',
                  border: isActive ? '1px solid rgba(0, 255, 255, 0.1)' : '1px solid transparent',
                  transition: 'all var(--duration-fast) ease'
                }}
              >
                <Icon size={18} style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)' }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout Footer */}
        <div style={{ padding: '20px 16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-danger)',
              background: 'transparent',
              textAlign: 'left',
              transition: 'background var(--duration-fast) ease'
            }}
            className="btn-ghost"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Body */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
        {/* Top Header */}
        <header style={{
          height: 'var(--nav-height)',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          justifyContent: 'space-between',
          zIndex: 80
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Menu size={18} />
            </button>
            <h2 className="text-display" style={{ fontSize: '18px', fontWeight: '600' }}>
              Control Console
            </h2>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--color-success)',
              boxShadow: '0 0 8px var(--color-success)'
            }}></div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Cloud Sync Active</span>
          </div>
        </header>

        {/* Dashboard Child Page Content */}
        <main style={{
          flex: 1,
          padding: '32px',
          overflowY: 'auto',
          position: 'relative'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
