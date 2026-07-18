/**
 * PlaceholderPanels.tsx
 * Renders a placeholder modal for features that are not yet implemented
 * like Calls, Stories, and Linked Devices.
 */
'use client';

import React from 'react';
import { Phone, Users, Smartphone, X } from 'lucide-react';

/**
 * Props for the PlaceholderPanel component.
 */
interface PlaceholderPanelProps {
  type: 'calls' | 'stories' | 'devices' | null;
  onClose: () => void;
}

/**
 * PlaceholderPanel Component
 * Displays a modal with info about a specific feature (calls, stories, or devices).
 * 
 * @param {PlaceholderPanelProps} props - Component props including type and onClose callback.
 * @returns {JSX.Element | null} The rendered modal or null if no type is selected.
 */
export default function PlaceholderPanel({ type, onClose }: PlaceholderPanelProps) {
  // If no panel type is selected, do not render anything
  if (!type) return null;

  // Predefined content for each placeholder feature
  const contentMap = {
    calls: {
      title: 'Calls',
      icon: <Phone size={44} color="#3a76f0" style={{ animation: 'bounce 1s infinite' }} />,
      desc: 'Keep in touch with secure, crystal clear voice and video calls.',
      details: 'Signal E2E encryption secures all call streams between devices.',
    },
    stories: {
      title: 'Stories',
      icon: <Users size={44} color="#a855f7" style={{ animation: 'pulse 2s infinite' }} />,
      desc: 'Share updates with photos, videos, and texts that disappear in 24 hours.',
      details: 'Choose who can see your updates in stories settings.',
    },
    devices: {
      title: 'Linked Devices',
      icon: <Smartphone size={44} color="#22c55e" />,
      desc: 'Use Signal on your Desktop, iPad, or other secondary screens.',
      details: 'Scan a QR code in Signal settings on your mobile device to link.',
    },
  };

  // Determine the content based on the selected panel type
  const selected = contentMap[type];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, position: 'relative', overflow: 'hidden',
        backgroundColor: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            padding: 7, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'var(--muted)',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface2)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
        >
          <X size={18} />
        </button>

        {/* Icon circle */}
        <div style={{
          width: 88, height: 88, borderRadius: 9999,
          backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.12)',
        }}>
          {selected.icon}
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
          {selected.title}
        </h3>

        <span style={{
          display: 'inline-block', padding: '3px 12px', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color: '#3a76f0', background: 'rgba(58,118,240,0.12)',
          borderRadius: 9999, marginBottom: 14,
        }}>
          Coming Soon
        </span>

        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, maxWidth: 300 }}>
          {selected.desc}
        </p>

        <div style={{
          width: '100%', backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--muted)',
        }}>
          {selected.details}
        </div>
      </div>
    </div>
  );
}
