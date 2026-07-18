/**
 * SettingsModal.tsx
 * Renders the settings overlay allowing users to change their profile, privacy,
 * notifications, and appearance options (including theme switching).
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, Bell, Eye, Lock, HelpCircle, Sun, Moon, Check } from 'lucide-react';

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onAvatarChange?: (url: string) => void;
}

// 16 hand-picked DiceBear avatar options across 4 styles
const AVATAR_OPTIONS = [
  // avataaars style
  { url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',    label: 'Felix'   },
  { url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',    label: 'Aneka'   },
  { url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',      label: 'Mia'     },
  { url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zara',     label: 'Zara'    },
  // bottts style
  { url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rex',         label: 'Rex'     },
  { url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',        label: 'Nova'    },
  { url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Orion',       label: 'Orion'   },
  { url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Pixel',       label: 'Pixel'   },
  // fun-emoji style
  { url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Sunny',    label: 'Sunny'   },
  { url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Blaze',    label: 'Blaze'   },
  { url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cosmo',    label: 'Cosmo'   },
  { url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Luna',     label: 'Luna'    },
  // identicon style
  { url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Alpha',    label: 'Alpha'   },
  { url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Beta',     label: 'Beta'    },
  { url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Gamma',    label: 'Gamma'   },
  { url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Delta',    label: 'Delta'   },
];

/**
 * Reusable toggle switch — fully inline-styled so it reacts to CSS vars
 * 
 * @param {Object} props
 * @param {boolean} props.value - Current toggle state.
 * @param {function} props.onChange - Callback to change state.
 */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 9999,
        background: value ? '#3a76f0' : 'var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '2px',
        justifyContent: value ? 'flex-end' : 'flex-start',
        transition: 'all 0.2s',
        border: 'none', cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 9999,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

/**
 * Reusable settings row component.
 * 
 * @param {Object} props
 * @param {string} props.label - Row title.
 * @param {string} props.sub - Row description.
 * @param {React.ReactNode} props.children - Trailing elements like Toggles.
 */
function SettingRow({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px', borderRadius: 12,
      backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
    }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>{sub}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * SettingsModal Component
 * Main component providing tabs for Profile, Privacy, Notifications, and Appearance.
 * 
 * @param {SettingsModalProps} props - Component props.
 * @returns {JSX.Element | null}
 */
export default function SettingsModal({ isOpen, onClose, user, onAvatarChange }: SettingsModalProps) {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'notifications' | 'appearance'>('profile');
  const [readReceipts, setReadReceipts]           = useState(true);
  const [typingIndicators, setTypingIndicators]   = useState(true);
  const [notifications, setNotifications]         = useState(true);
  const [playSound, setPlaySound]                 = useState(true);
  const [theme, setTheme]                         = useState<'light' | 'dark'>('dark');
  const [fontSize, setFontSize]                   = useState<'normal' | 'large' | 'huge'>('normal');
  const [selectedAvatar, setSelectedAvatar]       = useState<string>(user?.avatar_url || '');

  // Sync theme state every time modal opens
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      setSelectedAvatar(user?.avatar_url || '');
    }
  }, [isOpen, user]);

  /**
   * Toggles the UI theme between dark and light modes.
   */
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', next);
  };

  /**
   * Handles user avatar selection and persists locally to ensure immediate visual updates.
   */
  const handleAvatarSelect = (url: string) => {
    setSelectedAvatar(url);
    onAvatarChange?.(url);
    // Persist to localStorage so sidebar avatar updates immediately
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        u.avatar_url = url;
        localStorage.setItem('user', JSON.stringify(u));
      } catch {}
    }
  };

  if (!isOpen) return null;

  const tabs: { key: typeof activeTab; icon: React.ReactNode; label: string }[] = [
    { key: 'profile',       icon: <HelpCircle size={15} />, label: 'Profile Info'    },
    { key: 'privacy',       icon: <Shield size={15} />,     label: 'Privacy'         },
    { key: 'notifications', icon: <Bell size={15} />,       label: 'Notifications'   },
    { key: 'appearance',    icon: <Eye size={15} />,        label: 'Appearance'      },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 660,
        backgroundColor: 'var(--surface)', color: 'var(--text)',
        borderRadius: 18, border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', height: 540, overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              padding: 6, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Sidebar */}
          <div style={{
            width: 180, flexShrink: 0, borderRight: '1px solid var(--border)',
            backgroundColor: 'var(--bg)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, textAlign: 'left', width: '100%',
                  background: activeTab === t.key ? '#3a76f0' : 'transparent',
                  color: activeTab === t.key ? '#fff' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (activeTab !== t.key) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface2)'; }}
                onMouseLeave={e => { if (activeTab !== t.key) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>

            {/* ── PROFILE TAB ── */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Current avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img
                    src={selectedAvatar || user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                    alt="Avatar"
                    style={{ width: 64, height: 64, borderRadius: 9999, border: '2px solid var(--border)', background: 'var(--surface2)' }}
                  />
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>{user?.display_name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '3px 0 0', fontFamily: 'monospace' }}>@{user?.phone_or_username}</p>
                  </div>
                </div>

                {/* Status chip */}
                <div style={{ padding: '10px 14px', borderRadius: 12, backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account status</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', fontSize: 13 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 9999, background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    Online &amp; verified
                  </div>
                </div>

                {/* Avatar picker */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Choose Avatar
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
                    {AVATAR_OPTIONS.map(av => {
                      const isChosen = selectedAvatar === av.url;
                      return (
                        <button
                          key={av.url}
                          onClick={() => handleAvatarSelect(av.url)}
                          title={av.label}
                          style={{
                            position: 'relative', padding: 0, border: isChosen ? '2.5px solid #3a76f0' : '2px solid var(--border)',
                            borderRadius: 9999, background: 'var(--surface2)', cursor: 'pointer',
                            transition: 'border-color 0.15s', overflow: 'hidden',
                          }}
                        >
                          <img src={av.url} alt={av.label} style={{ width: 44, height: 44, display: 'block' }} />
                          {isChosen && (
                            <div style={{
                              position: 'absolute', inset: 0, borderRadius: 9999,
                              background: 'rgba(58,118,240,0.35)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Check size={14} color="#fff" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                    Avatar changes apply immediately in the sidebar.
                  </p>
                </div>
              </div>
            )}

            {/* ── PRIVACY TAB ── */}
            {activeTab === 'privacy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Privacy &amp; Security
                </p>
                <SettingRow label="Read Receipts" sub="Show when you have read messages.">
                  <Toggle value={readReceipts} onChange={setReadReceipts} />
                </SettingRow>
                <SettingRow label="Typing Indicators" sub="Show when you are typing.">
                  <Toggle value={typingIndicators} onChange={setTypingIndicators} />
                </SettingRow>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12,
                  backgroundColor: 'var(--bg)', border: '1px solid var(--border)', opacity: 0.55,
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Block List</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>0 contacts blocked.</p>
                  </div>
                  <Lock size={15} color="var(--muted)" />
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS TAB ── */}
            {activeTab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Notification Preferences
                </p>
                <SettingRow label="Message Notifications" sub="Show notification banner on message receipt.">
                  <Toggle value={notifications} onChange={setNotifications} />
                </SettingRow>
                <SettingRow label="Play Sound" sub="Play tone for incoming messages.">
                  <Toggle value={playSound} onChange={setPlaySound} />
                </SettingRow>
              </div>
            )}

            {/* ── APPEARANCE TAB ── */}
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Display &amp; Theme
                </p>

                {/* Theme switcher */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12,
                  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Theme Mode</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>
                      Currently: <strong style={{ color: 'var(--text)' }}>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</strong>
                    </p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: '#3a76f0', color: '#fff', fontSize: 12, fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(58,118,240,0.35)', transition: 'background 0.15s',
                    }}
                  >
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                  </button>
                </div>

                {/* Font size */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12,
                  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Message Font Size</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>Configure chat text size.</p>
                  </div>
                  <select
                    value={fontSize}
                    onChange={e => setFontSize(e.target.value as any)}
                    style={{
                      padding: '5px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      backgroundColor: 'var(--surface)', color: 'var(--text)',
                      border: '1px solid var(--border)', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                    <option value="huge">Extra Large</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
