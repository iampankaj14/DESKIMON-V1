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

  // Voice Assistant Integration
  const [activeDevice, setActiveDevice] = useState(null);
  const [listeningOverlay, setListeningOverlay] = useState(false);
  const [recognitionText, setRecognitionText] = useState('');
  const [aiResponseText, setAiResponseText] = useState('');
  const [assistantStatus, setAssistantStatus] = useState('Standby');
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerId, setTimerId] = useState(null);
  const [recognitionObj, setRecognitionObj] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState('');

  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  // Initialize Speech Recognition on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';
        setRecognitionObj(rec);
      }
    }
  }, []);

  const initializeMicrophone = async () => {
    if (typeof window === 'undefined') return;
    setMicError('');
    try {
      console.log("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone permission granted.");
      window.localMicStream = stream; // keep it alive
      setMicActive(true);
    } catch (err) {
      console.error("Microphone initialization error:", err);
      setMicError(err.message || 'Access denied');
      setMicActive(false);
    }
  };

  // Auto-initialize microphone if permission already granted
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then((permissionStatus) => {
        if (permissionStatus.state === 'granted') {
          initializeMicrophone();
        }
        permissionStatus.onchange = () => {
          if (permissionStatus.state === 'granted') {
            initializeMicrophone();
          } else {
            setMicActive(false);
          }
        };
      }).catch(err => {
        console.warn("Query permission warning:", err);
      });
    }
  }, [recognitionObj]);

  // Poll active device status & subscribe to real-time status updates
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const activeId = localStorage.getItem('deskimon_active_device_id');
    if (!activeId) return;

    const fetchDeviceState = async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('id', activeId)
        .single();
      if (!error && data) {
        setActiveDevice(data);
        if (data.is_listening) {
          console.log("Resetting stuck listening state on page load...");
          supabase
            .from('devices')
            .update({ is_listening: false })
            .eq('id', activeId)
            .then(() => {
              console.log("Reset successful.");
            });
        }
      }
    };
    fetchDeviceState();

    const channel = supabase
      .channel(`active_device_status_layout_${activeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `id=eq.${activeId}`
        },
        (payload) => {
          console.log('Realtime active device status update:', payload.new);
          setActiveDevice(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  // Handle Voice Assistant wakeup from physical device trigger
  useEffect(() => {
    if (activeDevice && activeDevice.is_listening && !listeningOverlay) {
      startVoiceSession();
    }
  }, [activeDevice?.is_listening]);

  const startVoiceSession = async () => {
    if (!recognitionObj) {
      console.warn("Speech recognition not supported or not loaded yet.");
      return;
    }
    
    // Auto-request permission if not active
    if (!micActive) {
      await initializeMicrophone();
    }
    
    setListeningOverlay(true);
    setAssistantStatus('Listening');
    setRecognitionText('');
    setAiResponseText('');
    
    recognitionObj.onstart = () => {
      console.log("Speech recognition started...");
      setAssistantStatus('Listening');
    };
    
    recognitionObj.onresult = async (event) => {
      const resultText = event.results[0][0].transcript;
      console.log("Speech recognized:", resultText);
      setRecognitionText(resultText);
      
      // Process question with Gemini
      await processWithGemini(resultText);
    };
    
    recognitionObj.onerror = (err) => {
      if (err.error !== 'no-speech' && err.error !== 'aborted') {
        console.error("Speech recognition error event:", err.error, err.message, err);
      } else {
        console.log("Speech recognition status event:", err.error, err.message);
      }
      if (err.error === 'no-speech') {
        if (assistantStatus.includes('Waiting')) {
          restartListeningSilently();
        } else {
          setAssistantStatus('Listening (Speak now...)');
        }
      } else if (err.error === 'aborted') {
        console.log("Speech recognition aborted or restarted programmatically.");
      } else if (err.error === 'not-allowed') {
        setAssistantStatus('Microphone blocked! Please allow microphone access in your browser settings.');
      } else if (err.error === 'audio-capture') {
        setAssistantStatus('No microphone found. Please plug in a microphone.');
      } else if (err.error === 'network') {
        setAssistantStatus('Network error: Speech recognition server unreachable. Closing session in 5 seconds...');
        setTimeout(() => {
          closeVoiceSession();
        }, 5000);
      } else {
        setAssistantStatus(`Error: ${err.error || 'Speech error'}`);
      }
    };
    
    recognitionObj.onend = () => {
      console.log("Speech recognition ended.");
      if (listeningOverlay && assistantStatus.includes('Waiting')) {
        restartListeningSilently();
      }
    };
    
    try {
      recognitionObj.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
    }
  };

  const restartListeningSilently = () => {
    if (!recognitionObj) return;
    try {
      recognitionObj.start();
    } catch (e) {
      // Ignore if already running
    }
  };

  const processWithGemini = async (query) => {
    setAssistantStatus('Processing');
    const activeId = localStorage.getItem('deskimon_active_device_id');
    if (!activeId) return;
    
    try {
      console.log("Using API key:", GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 5)}...` : 'undefined');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY || ''}`;
      
      const requestBody = {
        contents: {
          parts: [
            {
              text: `You are DESKIMON, a smart, funny, and expressive desk companion. Keep your response extremely brief, engaging, and friendly. Maximum 120 characters and 1-2 short sentences. User query: "${query}"`
            }
          ]
        }
      };
      
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log("Gemini API HTTP Status:", response.status);
      const resJson = await response.json();
      console.log("Gemini API response JSON:", resJson);
      
      const aiResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I couldn't process that.";
      console.log("Gemini Response:", aiResponse);
      setAiResponseText(aiResponse);
      
      setAssistantStatus('Responding');
      
      // Generate Translate TTS URL (under 150 chars to avoid Translate block)
      const cleanText = encodeURIComponent(aiResponse.substring(0, 150));
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${cleanText}`;
      
      // Update Supabase device_preferences table with the audio_url
      await supabase
        .from('device_preferences')
        .update({ audio_url: audioUrl })
        .eq('device_id', activeId);
        
      // Log interaction in db
      await supabase
        .from('interactions')
        .insert({
          device_id: activeId,
          interaction_type: 'voice',
          user_input: query,
          ai_response: aiResponse,
          emotion_triggered: 'happy',
          latency_ms: 300
        });

      // Clear the audio_url after 3.5 seconds so it is ready for subsequent triggers
      setTimeout(async () => {
        await supabase
          .from('device_preferences')
          .update({ audio_url: null })
          .eq('device_id', activeId);
      }, 3500);

      // Start/reset 1 minute conversation session
      setAssistantStatus('Waiting (1m continuous mode)');
      startContinuousTimer();
      
    } catch (err) {
      console.error("Error processing with Gemini/TTS:", err);
      setAssistantStatus('Error');
      setTimeout(() => closeVoiceSession(), 3000);
    }
  };

  const startContinuousTimer = () => {
    if (timerId) clearInterval(timerId);
    setTimeLeft(60);
    
    const tid = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tid);
          closeVoiceSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setTimerId(tid);
    
    // Automatically restart speech recognition after response is sent
    setTimeout(() => {
      restartListeningSilently();
    }, 4000);
  };

  const closeVoiceSession = async () => {
    console.log("Closing voice interaction session...");
    setListeningOverlay(false);
    setAssistantStatus('Standby');
    
    if (timerId) {
      clearInterval(timerId);
      setTimerId(null);
    }
    
    const activeId = localStorage.getItem('deskimon_active_device_id');
    if (activeId) {
      await supabase
        .from('devices')
        .update({ is_listening: false })
        .eq('id', activeId);
    }
    
    if (recognitionObj) {
      try {
        recognitionObj.stop();
      } catch (e) {}
    }
  };

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
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Microphone Pre-Authorization Button */}
            <button
              onClick={initializeMicrophone}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                background: micActive ? 'rgba(0, 255, 255, 0.05)' : 'rgba(255, 165, 0, 0.1)',
                border: micActive ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(255, 165, 0, 0.3)',
                color: micActive ? 'var(--color-primary)' : '#FFA500',
                transition: 'all 0.2s ease',
                boxShadow: micActive ? '0 0 8px rgba(0, 255, 255, 0.1)' : '0 0 8px rgba(255, 165, 0, 0.1)'
              }}
            >
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: micActive ? 'var(--color-primary)' : '#FFA500',
                boxShadow: micActive ? '0 0 6px var(--color-primary)' : '0 0 6px #FFA500',
                animation: micActive ? 'none' : 'pulse-glow 1s infinite'
              }} />
              <span>{micActive ? '🎙️ Voice Active' : '🎙️ Enable Hands-Free Mic'}</span>
            </button>

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

      {/* Glassmorphic voice overlay UI */}
      {listeningOverlay && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 5, 5, 0.9)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontFamily: 'var(--font-body)',
          color: 'var(--text-primary)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '500px',
            background: 'rgba(15, 15, 15, 0.7)',
            border: '1px solid rgba(0, 255, 255, 0.15)',
            boxShadow: '0 0 50px rgba(0, 255, 255, 0.1), inset 0 0 20px rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            position: 'relative'
          }}>
            {/* Pulsing AI Circle */}
            <div style={{
              position: 'relative',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--color-primary) 0%, rgba(0, 255, 255, 0.2) 70%)',
              boxShadow: '0 0 30px var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: assistantStatus === 'Listening' ? 'float 2s infinite ease-in-out' : 
                         assistantStatus === 'Processing' ? 'pulse-glow 0.8s infinite linear' : 'none'
            }}>
              <span style={{ fontSize: '32px' }}>🤖</span>
            </div>

            {/* Assistant Status */}
            <div>
              <h3 className="text-display" style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
                DESKIMON AI Brain
              </h3>
              <p style={{ 
                color: assistantStatus === 'Listening' ? 'var(--color-primary)' : 
                       assistantStatus === 'Processing' ? '#FFD700' : 'var(--color-success)',
                fontSize: '14px',
                fontWeight: '600',
                marginTop: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {assistantStatus}
              </p>
            </div>

            {/* Interactive dialog log */}
            <div style={{
              width: '100%',
              minHeight: '120px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'left',
              fontSize: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              {recognitionText && (
                <div>
                  <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>🎤 User: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>&quot;{recognitionText}&quot;</span>
                </div>
              )}
              {aiResponseText && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                  <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>🤖 Deskimon: </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>&quot;{aiResponseText}&quot;</span>
                </div>
              )}
              {!recognitionText && !aiResponseText && (
                <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', margin: 'auto' }}>
                  {!micActive ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <p style={{ color: '#FFA500', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                        Microphone access is required for speech recognition.
                      </p>
                      <button
                        onClick={initializeMicrophone}
                        style={{
                          background: 'var(--gradient-primary)',
                          border: 'none',
                          color: 'var(--text-inverse)',
                          padding: '10px 20px',
                          borderRadius: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          fontSize: '13px',
                          boxShadow: '0 0 15px var(--color-primary)',
                          transition: 'transform 0.1s'
                        }}
                      >
                        🎙️ Enable Microphone
                      </button>
                    </div>
                  ) : (
                    <em>Waiting for speech... Speak clearly into your microphone.</em>
                  )}
                </div>
              )}
            </div>

            {/* Continuous countdown timer */}
            {assistantStatus.includes('Waiting') && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Continuous mode active. Waking down in <strong style={{ color: 'var(--color-primary)' }}>{timeLeft}s</strong> unless you speak again.
              </div>
            )}

            {/* Close Button */}
            <button 
              onClick={closeVoiceSession}
              style={{
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.2)',
                color: 'var(--color-danger)',
                padding: '10px 24px',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              className="btn-ghost"
            >
              Exit Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
