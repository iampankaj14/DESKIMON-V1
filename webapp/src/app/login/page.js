'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import BRANDING from '@/lib/branding';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Synchronize SignUp vs Login toggling based on search query params (?signup=true)
  useEffect(() => {
    if (searchParams.get('signup') === 'true') {
      setIsSignUp(true);
    } else {
      setIsSignUp(false);
    }
  }, [searchParams]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || 'Deskimon Owner',
            },
          },
        });

        if (signUpError) throw signUpError;

        // If email confirmation is enabled, notify user
        if (data?.user && data?.session === null) {
          setSuccess('Signup successful! Check your email for verification link.');
        } else {
          setSuccess('Signup successful! Redirecting to dashboard...');
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        }
      } else {
        // Login Flow
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) throw loginError;

        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch (err) {
      setError(err.message || 'An authentication error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '420px',
      margin: '0 auto',
      position: 'relative',
      zIndex: 1
    }}>
      {/* Brand logo/back link */}
      <div className="text-center" style={{ marginBottom: '24px' }}>
        <Link href="/" className="text-display" style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', textDecoration: 'none' }}>
          {BRANDING.name}
        </Link>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          {isSignUp ? 'Create your owner account' : 'Sign in to manage your companion'}
        </p>
      </div>

      {/* Auth Card */}
      <div className="card card-glass" style={{ padding: '32px', borderRadius: 'var(--radius-lg)' }}>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {isSignUp && (
            <div>
              <label className="input-label" htmlFor="name">Display Name</label>
              <input 
                id="name"
                type="text" 
                className="input" 
                placeholder="e.g. Pankaj Kumar" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="input-label" htmlFor="email">Email Address</label>
            <input 
              id="email"
              type="email" 
              className="input" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="input-label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
              {!isSignUp && (
                <Link href="/login/forgot" style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
                  Forgot?
                </Link>
              )}
            </div>
            <input 
              id="password"
              type="password" 
              className="input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ 
              padding: '12px', 
              borderRadius: 'var(--radius-sm)', 
              background: 'rgba(255, 107, 107, 0.1)', 
              border: '1px solid rgba(255, 107, 107, 0.2)',
              color: 'var(--color-danger)',
              fontSize: '13px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div style={{ 
              padding: '12px', 
              borderRadius: 'var(--radius-sm)', 
              background: 'rgba(74, 222, 128, 0.1)', 
              border: '1px solid rgba(74, 222, 128, 0.2)',
              color: 'var(--color-success)',
              fontSize: '13px'
            }}>
              ✅ {success}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px' }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Register Account' : 'Sign In')}
          </button>
        </form>

        {/* Toggle signup/login */}
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button 
                onClick={() => {
                  setIsSignUp(false);
                  router.replace('/login');
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: '600' }}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              New to {BRANDING.nameDisplay}?{' '}
              <button 
                onClick={() => {
                  setIsSignUp(true);
                  router.replace('/login?signup=true');
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: '600' }}
              >
                Create Account
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Back to Home Link */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Link href="/" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      position: 'relative',
      padding: '24px',
      overflow: 'hidden'
    }}>
      {/* Decorative Blur Backgrounds */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '40%',
        height: '40%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 255, 255, 0.08) 0%, transparent 70%)',
        filter: 'blur(40px)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '40%',
        height: '40%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(123, 97, 255, 0.08) 0%, transparent 70%)',
        filter: 'blur(40px)',
        zIndex: 0
      }} />

      <Suspense fallback={
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading page...</div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
