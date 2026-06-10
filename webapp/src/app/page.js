'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import BRANDING from '@/lib/branding';

export default function Home() {
  const [eyeExpression, setEyeExpression] = useState('neutral');
  const [blinkState, setBlinkState] = useState(false);

  // Random eye animations (blinking and expression changes) on landing page to show off DESKIMON's personality
  useEffect(() => {
    const expressions = ['neutral', 'happy', 'curious', 'wink', 'sleepy'];
    
    // Blink interval
    const blinkInterval = setInterval(() => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 200);
    }, 4000);

    // Expression interval
    const expressionInterval = setInterval(() => {
      const randomExpr = expressions[Math.floor(Math.random() * expressions.length)];
      setEyeExpression(randomExpr);
    }, 8000);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(expressionInterval);
    };
  }, []);

  return (
    <div className="landing-page" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
      {/* Background Glow */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '1200px',
          height: '600px',
          background: 'var(--gradient-glow)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Header / Navigation */}
      <header 
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(5, 5, 5, 0.75)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
          height: 'var(--nav-height)',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div className="container flex flex-between flex-center" style={{ width: '100%' }}>
          <Link href="/" className="text-display" style={{ fontSize: '24px', fontWeight: '800', tracking: '0.05em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--gradient-primary)', boxShadow: '0 0 10px var(--color-primary)' }}></span>
            {BRANDING.name}
          </Link>
          
          <nav className="flex gap-lg" style={{ display: 'flex', alignItems: 'center' }}>
            {BRANDING.nav.links.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                className="btn-ghost" 
                style={{ fontSize: '14px', fontWeight: '500', transition: 'color var(--duration-fast)' }}
              >
                {link.label}
              </Link>
            ))}
            <Link 
              href="/login" 
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="section" style={{ position: 'relative', zIndex: 1, padding: 'var(--space-3xl) 0 var(--space-4xl)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 'var(--space-2xl)', alignItems: 'center' }}>
          
          {/* Left Hero Content */}
          <div className="animate-slide-up">
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'rgba(0, 255, 255, 0.05)',
                border: '1px solid rgba(0, 255, 255, 0.15)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--color-primary)',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: 'var(--space-md)'
              }}
            >
              <span className="animate-float" style={{ display: 'inline-block' }}>✨</span> Meets AI, expressiveness, and sound
            </div>
            
            <h1 className="text-display" style={{ marginBottom: 'var(--space-md)', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', lineHeight: '1.05' }}>
              Meet <span className="text-gradient">{BRANDING.nameDisplay}</span>
            </h1>
            
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxLine: '3', marginBottom: 'var(--space-xl)', maxWidth: '540px' }}>
              {BRANDING.description} Wake it with <strong style={{ color: 'var(--color-primary)' }}>&quot;{BRANDING.wakeWord}&quot;</strong> and customize its character, looks, and logic instantly.
            </p>

            <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
              <Link href="/login?signup=true" className="btn btn-primary btn-lg">
                Build a Profile
              </Link>
              <Link href="/shop" className="btn btn-secondary btn-lg">
                Buy DESKIMON
              </Link>
            </div>
          </div>

          {/* Right Hero Visual (Animated Eyes) */}
          <div className="flex flex-center animate-fade-in animate-delay-2" style={{ position: 'relative' }}>
            {/* Glowing Backdrop Circle */}
            <div 
              style={{
                position: 'absolute',
                width: '320px',
                height: '320px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(123, 97, 255, 0.1) 0%, transparent 70%)',
                filter: 'blur(20px)',
                zIndex: -1
              }}
            />

            {/* DESKIMON Physical Frame Simulation */}
            <div 
              style={{
                width: '300px',
                height: '300px',
                borderRadius: '50%',
                background: '#0a0a0a',
                border: '8px solid #1a1a1a',
                boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* Screen Glass Reflection */}
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)',
                  pointerEvents: 'none',
                  zIndex: 2
                }}
              />

              {/* Animated Eyes Container */}
              <div 
                style={{
                  display: 'flex',
                  gap: '40px',
                  transform: blinkState ? 'scaleY(0.05)' : 'scaleY(1)',
                  transition: 'transform 0.1s ease',
                  alignItems: 'center'
                }}
              >
                {/* Left Eye */}
                <div 
                  style={{
                    width: '55px',
                    height: '55px',
                    borderRadius: eyeExpression === 'happy' ? '50% 50% 0 0' : '50%',
                    background: 'var(--color-primary)',
                    boxShadow: '0 0 25px var(--color-primary)',
                    transition: 'all 0.3s var(--ease-spring)',
                    transform: eyeExpression === 'curious' ? 'translateY(-10px) scale(1.1)' : 
                               eyeExpression === 'sleepy' ? 'scaleY(0.4) translateY(10px)' : 'none'
                  }}
                />

                {/* Right Eye */}
                <div 
                  style={{
                    width: '55px',
                    height: '55px',
                    borderRadius: eyeExpression === 'happy' ? '50% 50% 0 0' : '50%',
                    background: 'var(--color-primary)',
                    boxShadow: '0 0 25px var(--color-primary)',
                    transition: 'all 0.3s var(--ease-spring)',
                    transform: eyeExpression === 'curious' ? 'translateY(5px) scale(0.9)' : 
                               eyeExpression === 'wink' ? 'scaleY(0.1)' :
                               eyeExpression === 'sleepy' ? 'scaleY(0.4) translateY(10px)' : 'none'
                  }}
                />
              </div>

              {/* Status Ring / Subtitle */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'rgba(0, 255, 255, 0.4)',
                  animation: 'pulse-glow 2s infinite'
                }}
              >
                Status: Expressing ({eyeExpression})
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="section" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="text-center" style={{ marginBottom: 'var(--space-3xl)' }}>
            <h2 className="text-display" style={{ marginBottom: 'var(--space-sm)' }}>
              Hardware Meets AI Excellence
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Crafted with premium components and cutting-edge software to bring a physical pet to life on your desk.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
            {BRANDING.features.map((feature, idx) => (
              <div 
                key={idx}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-sm)',
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{feature.icon}</div>
                <h3 className="text-display" style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{feature.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / Quick Links Section */}
      <section className="section" style={{ position: 'relative', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <h2 className="text-display" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 'var(--space-md)' }}>
            Ready to Wake Your <span className="text-gradient">DESKIMON</span>?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: 'var(--space-2xl)' }}>
            Configure your Wi-Fi, choose its voice, adjust the brightness of its glowing eyes, and monitor live sensor diagnostics all in one unified control dashboard.
          </p>
          
          <div className="flex flex-center gap-md">
            <Link href="/login?signup=true" className="btn btn-primary btn-lg">
              Get Started Now
            </Link>
            <Link href="/dashboard" className="btn btn-secondary btn-lg">
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer 
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--space-xl) 0',
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          background: 'var(--bg-primary)'
        }}
      >
        <div className="container flex flex-between flex-center" style={{ width: '100%' }}>
          <div>
            &copy; {new Date().getFullYear()} {BRANDING.name}. All rights reserved.
          </div>
          <div>
            Design Language v{BRANDING.version}
          </div>
        </div>
      </footer>
    </div>
  );
}
