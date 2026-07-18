/**
 * login/page.tsx
 * 
 * Contains the LoginPage component which handles user authentication,
 * including both registration and OTP-based login flows.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Shield, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import SignalLogo from '@/components/SignalLogo';

/**
 * LoginPage Component
 * 
 * Renders the authentication UI. Manages multi-step forms for user
 * registration and OTP login. Automatically generates avatar seeds based on input.
 * 
 * @returns The login page view.
 */
export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  
  // Fields
  const [phoneOrUsername, setPhoneOrUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [otp, setOtp] = useState('');
  
  // Steps
  const [step, setStep] = useState(1); // 1 = input phone, 2 = input otp
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-generate avatar seed when user starts typing display name
  useEffect(() => {
    if (displayName) {
      setAvatarSeed(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`);
    } else if (phoneOrUsername) {
      setAvatarSeed(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(phoneOrUsername)}`);
    } else {
      setAvatarSeed('');
    }
  }, [displayName, phoneOrUsername]);

  /**
   * Handles the submission of the first step (phone/username input).
   * Either registers a new user or transitions to the OTP step.
   * 
   * @param e - Form submission event.
   */
  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!phoneOrUsername.trim()) {
      setError('Username or phone number is required');
      return;
    }

    if (isRegister) {
      // Register
      if (!displayName.trim()) {
        setError('Display name is required');
        return;
      }
      setLoading(true);
      try {
        await api.register(phoneOrUsername, displayName, avatarSeed);
        // On successful register, automatically switch to OTP login
        setIsRegister(false);
        setStep(2);
      } catch (err: any) {
        setError(err.message || 'Registration failed');
      } finally {
        setLoading(false);
      }
    } else {
      // Move to OTP step for login
      setStep(2);
    }
  };

  /**
   * Handles the submission of the OTP verification step.
   * Logs the user in, stores the token, and redirects to the home page.
   * 
   * @param e - Form submission event.
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await api.login(phoneOrUsername, otp);
      // Save token in localStorage for easy lookup on websockets
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Go to Chat view
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Invalid code or username. Note: Registration is required first.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared input styles ──
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    backgroundColor: 'var(--bg)', color: 'var(--text)',
    border: '1px solid var(--border)',
    transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 8,
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg)', padding: '48px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, position: 'relative', overflow: 'hidden',
        backgroundColor: 'var(--surface)', padding: 32, borderRadius: 20,
        border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        {/* Glow effects */}
        <div style={{
          position: 'absolute', top: -96, left: -96, width: 192, height: 192,
          background: '#3a76f0', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.15, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -96, right: -96, width: 192, height: 192,
          background: '#6366f1', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.15, pointerEvents: 'none',
        }} />

        {/* Logo & Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#3a76f0', boxShadow: '0 8px 24px rgba(58,118,240,0.35)',
          }}>
            <SignalLogo size={40} color="#fff" />
          </div>
          <h2 style={{ marginTop: 20, fontSize: 26, fontWeight: 800, color: 'var(--text)', textAlign: 'center', letterSpacing: '-0.01em' }}>
            {isRegister ? 'Create an Account' : step === 1 ? 'Sign in to Signal' : 'Enter Verification Code'}
          </h2>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 300 }}>
            {isRegister 
              ? 'Enter your details to start sending messages' 
              : step === 1 
                ? 'Enter your phone number or username to continue' 
                : `We sent a 6-digit verification code to ${phoneOrUsername}`
            }
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: 12, marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 10,
            fontSize: 13, color: '#f87171',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Phone / Username */}
        {step === 1 && (
          <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Phone Number or Username</label>
              <input
                type="text"
                required
                placeholder="e.g. +123456789 or alice"
                value={phoneOrUsername}
                onChange={(e) => setPhoneOrUsername(e.target.value)}
                style={inputStyle}
              />
            </div>

            {isRegister && (
              <>
                <div>
                  <label style={labelStyle}>Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alice Smith"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {avatarSeed && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: 12,
                    backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                  }}>
                    <img 
                      src={avatarSeed} 
                      alt="Avatar Preview" 
                      style={{ width: 48, height: 48, borderRadius: 9999, backgroundColor: 'var(--surface2)', border: '1px solid var(--border)' }}
                    />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Avatar Generated</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: '2px 0 0' }}>Based on your display name seed</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                background: '#3a76f0', color: '#fff', opacity: loading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(58,118,240,0.3)', transition: 'opacity 0.15s',
              }}
            >
              {loading ? (
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  Continue
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: '#60a5fa',
                }}
              >
                {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>6-Digit OTP Code</label>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="Enter 123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={{
                  ...inputStyle,
                  textAlign: 'center', fontSize: 24, letterSpacing: '0.25em', fontFamily: 'monospace',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                background: '#3a76f0', color: '#fff', opacity: loading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(58,118,240,0.3)', transition: 'opacity 0.15s',
              }}
            >
              {loading ? (
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
              ) : 'Verify & Log In'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); setError(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setOtp('123456')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#60a5fa' }}
              >
                Auto-fill Code
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 11, color: 'var(--muted)',
        }}>
          <Shield size={14} color="#3a76f0" />
          <span>E2E Mock Encrypted Connection</span>
        </div>
      </div>
    </div>
  );
}
