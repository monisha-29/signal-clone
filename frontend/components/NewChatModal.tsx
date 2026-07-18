/**
 * NewChatModal.tsx
 * Modal component to start new direct messages or create new group conversations.
 * Handles searching users, fetching contacts, and creating API requests.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, Users, MessageSquare, Check, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { User, Conversation } from '@/lib/types';

/**
 * Props for NewChatModal component
 */
interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: Conversation) => void;
}

// ── shared inline style helpers ──────────────────────────────────────
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 12, padding: '10px 12px',
};

/**
 * NewChatModal Component
 * Modal for discovering users, managing contacts, and creating direct/group chats.
 * 
 * @param {NewChatModalProps} props - The props including isOpen state and callbacks.
 * @returns {JSX.Element | null} The modal UI.
 */
export default function NewChatModal({ isOpen, onClose, onConversationCreated }: NewChatModalProps) {
  // Local state for direct chat user search
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [contacts, setContacts]           = useState<any[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  // Local state for group chat creation
  const [isCreatingGroup, setIsCreatingGroup]   = useState(false);
  const [groupName, setGroupName]               = useState('');
  const [selectedMembers, setSelectedMembers]   = useState<number[]>([]);

  // Fetch contacts whenever the modal opens
  useEffect(() => {
    if (isOpen) fetchContacts();
  }, [isOpen]);

  // Debounce the search query to prevent excessive API calls
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery.trim()) searchUsers();
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /**
   * Fetches the user's current contacts list from the backend.
   */
  const fetchContacts = async () => {
    try { setContacts(await api.getContacts()); }
    catch (err) { console.error(err); }
  };

  /**
   * Searches for users across the platform using the current search query.
   */
  const searchUsers = async () => {
    setLoading(true); setError('');
    try { setSearchResults(await api.searchUsers(searchQuery)); }
    catch (err: any) { setError(err.message || 'Search failed'); }
    finally { setLoading(false); }
  };

  /**
   * Adds a new contact by username.
   */
  const handleAddContact = async (username: string) => {
    try {
      await api.addContact(username);
      fetchContacts(); setSearchQuery(''); setSearchResults([]);
    } catch (err: any) { setError(err.message || 'Failed to add contact'); }
  };

  /**
   * Initiates a new direct chat conversation with the specified user.
   */
  const handleStartDirectChat = async (userId: number) => {
    setLoading(true); setError('');
    try {
      const conv = await api.createDirectChat(userId);
      onConversationCreated(conv); onClose();
    } catch (err: any) { setError(err.message || 'Failed to start chat'); }
    finally { setLoading(false); }
  };

  /**
   * Creates a new group conversation with the selected members and group name.
   */
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!groupName.trim()) { setError('Group name is required'); return; }
    if (selectedMembers.length === 0) { setError('Select at least one member'); return; }
    setLoading(true);
    try {
      const conv = await api.createGroupChat(groupName, selectedMembers);
      onConversationCreated(conv); onClose();
      // Reset group creation state upon success
      setGroupName(''); setSelectedMembers([]); setIsCreatingGroup(false);
    } catch (err: any) { setError(err.message || 'Failed to create group'); }
    finally { setLoading(false); }
  };

  /**
   * Toggles a user's selection status when building a group.
   */
  const toggleMember = (id: number) =>
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (!isOpen) return null;

  // reusable row hover handlers
  const rowHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) =>
      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface2)',
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) =>
      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        backgroundColor: 'var(--surface)', color: 'var(--text)',
        borderRadius: 18, border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', height: 520, overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {isCreatingGroup ? 'New Group' : 'New Message'}
          </h2>
          <button
            onClick={() => { setIsCreatingGroup(false); onClose(); }}
            style={{ padding: 6, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface2)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div style={{ padding: '8px 20px', fontSize: 12, background: 'rgba(239,68,68,0.12)', color: '#f87171', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* ── DIRECT CHAT VIEW ── */}
        {!isCreatingGroup ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Search bar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search username or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 36px',
                  borderRadius: 12, fontSize: 13, outline: 'none',
                  backgroundColor: 'var(--bg)', color: 'var(--text)',
                  border: '1px solid var(--border)', boxSizing: 'border-box',
                }}
              />
              <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: 28, top: 22 }} />
            </div>

            {/* Create Group quick action */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={() => setIsCreatingGroup(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer' }}
                {...rowHover}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(58,118,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} color="#3a76f0" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Create Group Conversation</span>
              </div>
            </div>

            {/* Results / Contacts list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
              {searchQuery.trim() ? (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 4px' }}>
                    Search Results
                  </p>
                  {loading && <RefreshCw size={18} color="#3a76f0" style={{ animation: 'spin 1s linear infinite', margin: '12px auto', display: 'block' }} />}
                  {!loading && searchResults.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--muted)', padding: '4px 4px' }}>No users match query.</p>
                  )}
                  {searchResults.map(usr => {
                    const isContact = contacts.some(c => c.contact_user.id === usr.id);
                    return (
                      <div
                        key={usr.id}
                        onClick={() => handleStartDirectChat(usr.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 12, cursor: 'pointer', marginBottom: 4 }}
                        {...rowHover}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src={usr.avatar_url || ''} alt="Avatar" style={{ width: 36, height: 36, borderRadius: 9999, backgroundColor: 'var(--surface2)' }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--text)' }}>{usr.display_name}</p>
                            <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>@{usr.phone_or_username}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!isContact && (
                            <button
                              onClick={e => { e.stopPropagation(); handleAddContact(usr.phone_or_username); }}
                              title="Add to Contacts"
                              style={{ padding: 8, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(58,118,240,0.12)', color: '#3a76f0' }}
                            >
                              <UserPlus size={14} />
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); handleStartDirectChat(usr.id); }}
                            title="Start Chat"
                            style={{ padding: 8, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}
                          >
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 4px' }}>
                    Contacts
                  </p>
                  {contacts.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--muted)', padding: '4px 4px' }}>
                      No contacts yet. Search users above to add them.
                    </p>
                  ) : (
                    contacts.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleStartDirectChat(c.contact_user.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, cursor: 'pointer', marginBottom: 4 }}
                        {...rowHover}
                      >
                        <img src={c.contact_user.avatar_url || ''} alt="Avatar" style={{ width: 36, height: 36, borderRadius: 9999, backgroundColor: 'var(--surface2)' }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--text)' }}>{c.contact_user.display_name}</p>
                          <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>@{c.contact_user.phone_or_username}</p>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>

        ) : (
          /* ── GROUP CREATION VIEW ── */
          <form onSubmit={handleCreateGroup} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20, gap: 14 }}>

            {/* Group name input */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Group Name
              </label>
              <input
                type="text" required
                placeholder="e.g. Workspace Squad"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                  backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                }}
              />
            </div>

            {/* Member selector */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Select Members ({selectedMembers.length})
              </label>
              <div style={{
                flex: 1, overflowY: 'auto', padding: 10,
                backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {contacts.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', padding: 6 }}>No contacts to add. Add contacts first.</p>
                ) : contacts.map(c => {
                  const isSelected = selectedMembers.includes(c.contact_user.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleMember(c.contact_user.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(58,118,240,0.1)' : 'transparent',
                        border: isSelected ? '1px solid rgba(58,118,240,0.3)' : '1px solid transparent',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface2)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={c.contact_user.avatar_url || ''} alt="Avatar" style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: 'var(--surface2)' }} />
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: 'var(--text)' }}>{c.contact_user.display_name}</p>
                          <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>@{c.contact_user.phone_or_username}</p>
                        </div>
                      </div>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? '#3a76f0' : 'transparent',
                        border: isSelected ? '2px solid #3a76f0' : '2px solid var(--border)',
                        transition: 'all 0.15s',
                      }}>
                        {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsCreatingGroup(false)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', backgroundColor: 'transparent',
                  color: 'var(--muted)', border: '1px solid var(--border)',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                  background: '#3a76f0', color: '#fff', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Group'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
