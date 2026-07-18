/**
 * ChatLayout.tsx
 * The main layout for the messaging interface. It manages WebSocket connections,
 * handles incoming/outgoing messages, conversations state, typing indicators,
 * file uploads, poll creation, and rendering of the central chat UI.
 */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { Conversation, Message, User } from '@/lib/types';
import { 
  Search, MessageSquare, Phone, Video, Send, 
  Settings, LogOut, Check, CheckCheck, Loader2, 
  Users, Smartphone, UserPlus, Info,
  Sparkles, Shield, X, SquarePen,
  PanelLeftClose, PanelLeftOpen, Paperclip, Download,
  Image as ImageIcon, FileText, BarChart3
} from 'lucide-react';
import SettingsModal from './SettingsModal';
import PlaceholderPanel from './PlaceholderPanels';
import NewChatModal from './NewChatModal';
import SignalLogo from './SignalLogo';

/**
 * Helper to format ISO date strings into local HH:MM time strings.
 * 
 * @param {string} dateStr - Date string to parse.
 * @returns {string} Formatted time string.
 */
const formatMessageTime = (dateStr: string) => {
  if (!dateStr) return '';
  const hasTimezone = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr);
  const parsedDate = new Date(hasTimezone ? dateStr : dateStr + 'Z');
  return parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Renders an avatar image or a fallback initial with a deterministic background color.
 * 
 * @param {string | null | undefined} url - The URL of the avatar.
 * @param {string} name - User's name for fallback initial.
 * @param {string} sizeClass - Tailwind classes determining dimensions.
 * @returns {JSX.Element} The rendered avatar.
 */
const renderAvatar = (url: string | null | undefined, name: string, sizeClass = "w-10 h-10") => {
  if (url && url.trim() !== '') {
    return <img src={url} className={`${sizeClass} rounded-full object-cover`} alt={name} />;
  }
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#ea580c'];
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <div 
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold select-none`}
      style={{ backgroundColor: color, fontSize: sizeClass.includes('w-11') ? '16px' : sizeClass.includes('w-8') ? '11px' : '13px' }}
    >
      {initial}
    </div>
  );
};

/**
 * PollCard Component
 * Parses and renders interactive poll cards directly within the message feed.
 * 
 * @param {Object} props
 * @param {string} props.content - The raw poll message content string.
 * @param {boolean} props.isMe - True if the message was sent by the current user.
 * @returns {JSX.Element}
 */
const PollCard = ({ content, isMe }: { content: string; isMe: boolean }) => {
  // Extract question and options from raw [POLL]: string format
  const parts = content.replace('[POLL]:', '').split('|').map(x => x.trim());
  const question = parts[0];
  const options = parts.slice(1);

  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);

  const handleVote = (opt: string) => {
    if (myVote) return;
    setVotes(prev => ({ ...prev, [opt]: (prev[opt] || 0) + 1 }));
    setMyVote(opt);
  };

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const accentColor = '#3a76f0';

  return (
    <div style={{
      background: isMe ? 'rgba(58,118,240,0.13)' : 'var(--surface)',
      border: `1.5px solid ${isMe ? 'rgba(58,118,240,0.35)' : 'var(--border)'}`,
      borderRadius: 18,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minWidth: 260,
      maxWidth: 300,
    }}>
      {/* Header badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(58,118,240,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <BarChart3 size={15} color={isMe ? '#93c5fd' : accentColor} />
        </div>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: isMe ? 'rgba(255,255,255,0.6)' : 'var(--muted)', textTransform: 'uppercase' }}>Poll</span>
        </div>
        {!myVote && (
          <span style={{
            marginLeft: 'auto', fontSize: 9, fontWeight: 600, padding: '2px 7px',
            borderRadius: 20, background: isMe ? 'rgba(255,255,255,0.12)' : 'rgba(58,118,240,0.1)',
            color: isMe ? 'rgba(255,255,255,0.7)' : accentColor, border: `1px solid ${isMe ? 'rgba(255,255,255,0.2)' : 'rgba(58,118,240,0.25)'}`,
          }}>
            VOTE
          </span>
        )}
      </div>

      {/* Question */}
      <p style={{
        fontSize: 14, fontWeight: 700, margin: 0,
        color: isMe ? '#fff' : 'var(--text)',
        lineHeight: 1.4,
      }}>{question}</p>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt, i) => {
          const count = votes[opt] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isChosen = myVote === opt;
          return (
            <div
              key={i}
              onClick={() => handleVote(opt)}
              style={{
                position: 'relative', overflow: 'hidden',
                padding: '9px 12px', borderRadius: 12,
                border: isChosen
                  ? `1.5px solid ${accentColor}`
                  : isMe ? '1.5px solid rgba(255,255,255,0.15)' : '1.5px solid var(--border)',
                cursor: myVote ? 'default' : 'pointer',
                background: isMe
                  ? (isChosen ? 'rgba(58,118,240,0.35)' : 'rgba(255,255,255,0.07)')
                  : (isChosen ? 'rgba(58,118,240,0.1)' : 'var(--bg)'),
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13, transition: 'all 0.18s',
              }}
              onMouseEnter={e => {
                if (!myVote) (e.currentTarget as HTMLDivElement).style.background =
                  isMe ? 'rgba(255,255,255,0.13)' : 'var(--surface2)';
              }}
              onMouseLeave={e => {
                if (!myVote) (e.currentTarget as HTMLDivElement).style.background =
                  isMe ? 'rgba(255,255,255,0.07)' : 'var(--bg)';
              }}
            >
              {/* Progress bar fill */}
              {myVote && pct > 0 && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: isChosen
                    ? (isMe ? 'rgba(147,197,253,0.2)' : 'rgba(58,118,240,0.15)')
                    : (isMe ? 'rgba(255,255,255,0.06)' : 'rgba(58,118,240,0.07)'),
                  transition: 'width 0.4s cubic-bezier(.4,0,.2,1)',
                  zIndex: 0,
                }} />
              )}
              <span style={{
                position: 'relative', zIndex: 1,
                fontWeight: isChosen ? 700 : 500,
                color: isMe ? (isChosen ? '#fff' : 'rgba(255,255,255,0.85)') : (isChosen ? accentColor : 'var(--text)'),
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {isChosen && <Check size={13} />}
                {opt}
              </span>
              {myVote && (
                <span style={{
                  position: 'relative', zIndex: 1,
                  fontSize: 11, fontWeight: 700,
                  color: isChosen ? accentColor : (isMe ? 'rgba(255,255,255,0.45)' : 'var(--muted)'),
                  flexShrink: 0, marginLeft: 6,
                }}>
                  {pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.45)' : 'var(--muted)' }}>
          {myVote ? `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}` : `${options.length} options`}
        </span>
        {!myVote && (
          <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.45)' : 'var(--muted)' }}>
            Tap to vote
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Main ChatLayout Component
 * Houses the sidebars, chat list, main messaging pane, and modal overlays.
 * Orchestrates WS connection and state syncing.
 */
export default function ChatLayout() {
  const router = useRouter();
  
  // App States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [isTypingMap, setIsTypingMap] = useState<Record<number, string>>({}); // convId -> typing message

  // Modals / Panels
  const [showSettings, setShowSettings] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [placeholderType, setPlaceholderType] = useState<'calls' | 'stories' | 'devices' | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<any>(null);

  // References
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const wsSubscribed = useRef(false);

  // Upload & Popover states
  const [uploading, setUploading] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);

  // Poll Builder states
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Load user profile and initial chats
  useEffect(() => {
    const initApp = async () => {
      try {
        const user = await api.me();
        setCurrentUser(user);
        
        // Connect WebSockets
        const token = localStorage.getItem('access_token');
        if (token) {
          wsClient.connect(token);
          setIsConnected(true);
        } else {
          router.push('/login');
          return;
        }

        // Load chats
        const chats = await api.getConversations();
        setConversations(chats);
      } catch (err) {
        console.error('Initialization error:', err);
        router.push('/login');
      }
    };

    initApp();

    return () => {
      wsClient.disconnect();
    };
  }, []);

  // WebSocket Subscriber
  // Listens for incoming socket events (message, typing, read_receipt)
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = wsClient.subscribe((data) => {
      const { event, conversation_id } = data;

      if (event === 'message') {
        const msg = data.message;
        
        // Update messages array if looking at this chat
        if (selectedConversation && selectedConversation.id === conversation_id) {
          setMessages((prev) => {
            // Replace the optimistic message (which has a negative ID)
            const optimisticIndex = prev.findIndex((m) => m.id < 0 && m.content === msg.content);
            if (optimisticIndex !== -1) {
              const updated = [...prev];
              updated[optimisticIndex] = msg;
              return updated;
            }
            // Avoid duplicate additions
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          
          // Send back a read receipt dynamically
          wsClient.sendReadReceipt(conversation_id);
        }

        // Update last message in the conversations preview
        setConversations((prev) => {
          return prev.map((c) => {
            if (c.id === conversation_id) {
              const isUnread = selectedConversation?.id !== conversation_id;
              return {
                ...c,
                last_message: msg,
                last_message_at: msg.created_at,
                unread_count: isUnread ? c.unread_count + 1 : 0
              };
            }
            return c;
          }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        });
      }

      else if (event === 'typing') {
        const { user_id, username, is_typing } = data;
        setIsTypingMap((prev) => {
          if (is_typing) {
            return { ...prev, [conversation_id]: `${username} is typing...` };
          } else {
            const next = { ...prev };
            delete next[conversation_id];
            return next;
          }
        });
      }

      else if (event === 'read_receipt') {
        const { last_read_message_id } = data;
        
        // Update messages statuses to read
        if (selectedConversation && selectedConversation.id === conversation_id) {
          setMessages((prev) => {
            return prev.map((m) => {
              if (m.id <= last_read_message_id && m.status !== 'read') {
                return { ...m, status: 'read' };
              }
              return m;
            });
          });
        }

        // Update in conversation list
        setConversations((prev) => {
          return prev.map((c) => {
            if (c.id === conversation_id && c.last_message && c.last_message.id <= last_read_message_id) {
              return {
                ...c,
                last_message: { ...c.last_message, status: 'read' }
              };
            }
            return c;
          });
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, selectedConversation]);

  // Load messages when selecting conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const loadMessages = async () => {
      try {
        const msgs = await api.getMessages(selectedConversation.id);
        setMessages(msgs);
        
        // Reset unread count locally
        setConversations((prev) => 
          prev.map((c) => c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c)
        );

        // Tell websocket server we read this conversation
        wsClient.sendReadReceipt(selectedConversation.id);
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };

    loadMessages();
    setShowMembersPanel(false);
  }, [selectedConversation]);

  // Scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTypingMap]);

  // Send message handler
  const handleSendMessage = (e?: React.FormEvent, attachmentUrl?: string | null, attachmentType?: string | null) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachmentUrl && !selectedConversation || !currentUser) return;
    if (!selectedConversation) return;

    // Create optimistic message
    const tempMsg: Message = {
      id: -Date.now(), // negative temporary ID
      conversation_id: selectedConversation.id,
      sender_id: currentUser.id,
      content: inputText.trim(),
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, tempMsg]);

    // Send via websocket
    wsClient.sendMessage(selectedConversation.id, inputText.trim(), attachmentUrl, attachmentType);

    // Trigger typing stop
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    wsClient.sendTyping(selectedConversation.id, false);

    setInputText('');
  };

  /**
   * File upload handler. Uploads the file via API, then sends its URL
   * as a message attachment through the WebSocket.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement | null>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    setUploading(true);
    setShowAttachmentMenu(false);
    try {
      const res = await api.uploadFile(file);
      // Auto-send the uploaded attachment URL
      handleSendMessage(undefined, res.url, res.type);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
      if (ref.current) {
        ref.current.value = '';
      }
    }
  };

  const handleSendPoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !pollQuestion.trim()) return;
    
    // Filter empty options
    const options = pollOptions.map(o => o.trim()).filter(o => o !== '');
    if (options.length < 2) return;

    // Send formatted poll payload
    const pollPayload = `[POLL]: ${pollQuestion.trim()} | ${options.join(' | ')}`;
    handleSendMessage(undefined, null, null); // We will set input text to this payload temporarily to send it
    
    // Optimistic UI updates
    const tempMsg: Message = {
      id: -Date.now(),
      conversation_id: selectedConversation.id,
      sender_id: currentUser!.id,
      content: pollPayload,
      created_at: new Date().toISOString(),
      status: 'sending',
    };
    setMessages((prev) => [...prev, tempMsg]);
    wsClient.sendMessage(selectedConversation.id, pollPayload);

    // Reset Form
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollModal(false);
  };

  // Handle keystrokes for typing indicators
  // Debounces typing state to prevent spamming the WS server
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!selectedConversation) return;

    // Notify typing start
    wsClient.sendTyping(selectedConversation.id, true);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    setTypingTimeout(
      setTimeout(() => {
        wsClient.sendTyping(selectedConversation.id, false);
      }, 2000)
    );
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const handleConversationCreated = (conv: Conversation) => {
    // Add to lists and select it
    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) return prev;
      return [conv, ...prev];
    });
    setSelectedConversation(conv);
  };

  // Search filtering
  const filteredConversations = conversations.filter((c) => {
    const name = c.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-screen overflow-hidden select-none" style={{backgroundColor:'var(--bg)'}}>
      
      {/* 1. Side Rail Icon Navigation */}
      <div className="w-16 border-r flex flex-col justify-between items-center py-4 flex-shrink-0" style={{backgroundColor:'var(--surface)',borderColor:'var(--border)'}}>
        <div className="flex flex-col items-center space-y-6">
          <div 
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer hover:border-blue-500 transition relative group" style={{borderColor:'var(--border)'}}
          >
            {renderAvatar(currentUser?.avatar_url, currentUser?.display_name || 'User', 'w-full h-full')}
            <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-green-500 border border-black rounded-full"></div>
          </div>
          
          <button 
            onClick={() => setPlaceholderType('calls')}
            className="p-2.5 rounded-xl transition hover:text-blue-500 hover:bg-blue-500/10"
            style={{color:'var(--muted)'}}
            title="Calls"
          >
            <Phone className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setPlaceholderType('stories')}
            className="p-2.5 rounded-xl transition hover:text-blue-500 hover:bg-blue-500/10"
            style={{color:'var(--muted)'}}
            title="Stories"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setPlaceholderType('devices')}
            className="p-2.5 rounded-xl transition hover:text-blue-500 hover:bg-blue-500/10"
            style={{color:'var(--muted)'}}
            title="Linked Devices"
          >
            <Smartphone className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <button 
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className="p-2.5 rounded-xl transition hover:text-blue-500 hover:bg-blue-500/10"
            style={{color:'var(--muted)'}}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl transition hover:text-blue-500 hover:bg-blue-500/10"
            style={{color:'var(--muted)'}}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl transition text-red-400 hover:text-red-600 hover:bg-red-500/10"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Conversations Left Panel — expandable / collapsible */}
      <div
        className="border-r flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          backgroundColor:'var(--surface)',
          borderColor:'var(--border)',
          width: sidebarCollapsed ? 0 : 320,
          minWidth: sidebarCollapsed ? 0 : 320,
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1), min-width 0.25s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {/* Panel Header */}
        <div className="p-4 flex items-center justify-between" style={{minWidth:320}}>
          <h1 className="text-xl font-bold tracking-wide" style={{color:'var(--text)'}}>Chats</h1>
          <button 
            onClick={() => setShowNewChat(true)}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center justify-center"
            title="New conversation"
          >
            <SquarePen className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3 relative" style={{minWidth:320}}>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            style={{backgroundColor:'var(--bg)',color:'var(--text)',border:'1px solid var(--border)'}}
          />
          <Search className="w-3.5 h-3.5 absolute left-7 top-3" style={{color:'var(--muted)'}} />
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1" style={{minWidth:320}}>
          {filteredConversations.length === 0 ? (
            <p className="text-xs text-center py-8" style={{color:'var(--muted)'}}>No chats found</p>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              const hasUnread = conv.unread_count > 0;
              const typingMsg = isTypingMap[conv.id];
              
              // Get message preview
              let lastMsgText = 'No messages';
              if (typingMsg) {
                lastMsgText = typingMsg;
              } else if (conv.last_message) {
                lastMsgText = conv.last_message.content;
              }

              // Message statuses check
              const isOutgoing = conv.last_message?.sender_id === currentUser?.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${isSelected ? 'bg-blue-600/10 border border-blue-500/20' : ''}`}
                  style={!isSelected ? {':hover':{backgroundColor:'var(--surface2)'}} as any : {}}
                  onMouseEnter={e => { if(!isSelected)(e.currentTarget as HTMLDivElement).style.backgroundColor='var(--surface2)'; }}
                  onMouseLeave={e => { if(!isSelected)(e.currentTarget as HTMLDivElement).style.backgroundColor=''; }}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    {renderAvatar(conv.avatar_url, conv.name || 'Group', 'w-11 h-11 border') }
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{color: isSelected ? '#60a5fa' : 'var(--text)'}}>
                        {conv.name}
                      </p>
                      <p className={`text-xs truncate ${typingMsg ? 'text-blue-400 italic' : ''}`} style={!typingMsg ? {color: hasUnread ? 'var(--text)' : 'var(--muted)'} : {}}>
                        {lastMsgText}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                    <span className="text-[10px]" style={{color:'var(--muted)'}}>
                      {conv.last_message ? formatMessageTime(conv.last_message.created_at) : ''}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {isOutgoing && conv.last_message && (
                        <span>
                          {conv.last_message.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                          ) : conv.last_message.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5" style={{color:'var(--muted)'}} />
                          ) : (
                            <Check className="w-3.5 h-3.5" style={{color:'var(--muted)'}} />
                          )}
                        </span>
                      )}
                      {hasUnread && (
                        <span className="bg-blue-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Center Chat Pane */}
      <div className="flex-1 flex flex-col min-w-0 relative" style={{backgroundColor:'var(--bg)'}}>
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="h-16 border-b px-6 flex items-center justify-between flex-shrink-0" style={{backgroundColor:'var(--surface)',borderColor:'var(--border)'}}>  
              <div className="flex items-center space-x-3 min-w-0">
                {renderAvatar(selectedConversation.avatar_url, selectedConversation.name || 'Chat', 'w-9 h-9 border')}
                <div className="min-w-0">
                  <h2 className="text-sm font-bold truncate" style={{color:'var(--text)'}}>{selectedConversation.name}</h2>
                  <p className="text-[10px]" style={{color:'var(--muted)'}}>
                    {isTypingMap[selectedConversation.id] || (selectedConversation.type === 'group' ? `${selectedConversation.members.length} members` : '🔒 E2E mock encrypted')}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setPlaceholderType('calls')}
                  className="p-2 rounded-xl transition"
                  style={{color:'var(--muted)'}}
                  onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor='var(--surface2)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor='transparent'}
                >
                  <Video className="w-5 h-5" />
                </button>
                {selectedConversation.type === 'group' && (
                  <button 
                    onClick={() => setShowMembersPanel(!showMembersPanel)}
                    className="p-2 rounded-xl transition"
                    style={showMembersPanel ? {backgroundColor:'rgba(58,118,240,0.12)',color:'#3a76f0'} : {color:'var(--muted)'}}
                    onMouseEnter={e=>{ if(!showMembersPanel)(e.currentTarget as HTMLButtonElement).style.backgroundColor='var(--surface2)'; }}
                    onMouseLeave={e=>{ if(!showMembersPanel)(e.currentTarget as HTMLButtonElement).style.backgroundColor='transparent'; }}
                  >
                    <Info className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages box */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase font-bold tracking-widest rounded-full flex items-center space-x-1.5 shadow-inner">
                  <Shield className="w-3.5 h-3.5 mr-1" />
                  Messages are end-to-end encrypted.
                </span>
              </div>

              {messages.map((msg, index) => {
                const isMe = msg.sender_id === currentUser?.id;
                const showSenderName = selectedConversation.type === 'group' && !isMe;
                
                return (
                  <div key={msg.id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {showSenderName && (
                      <span className="text-[10px] font-semibold mb-1 ml-3.5" style={{color:'var(--muted)'}}>
                        {msg.sender_name || 'Group Member'}
                      </span>
                    )}
                    <div className="flex items-end space-x-2 max-w-[75%]">
                      {msg.content?.startsWith('[POLL]:') ? (
                        /* ── Poll Card — no bubble wrapper ── */
                        <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          <PollCard content={msg.content} isMe={isMe} />
                          <div style={{display:'flex',justifyContent: isMe ? 'flex-end' : 'flex-start',gap:4,paddingLeft:4,paddingRight:4,fontSize:9,color:'var(--muted)',alignItems:'center'}}>
                            <span>{formatMessageTime(msg.created_at)}</span>
                            {isMe && (
                              <span>
                                {msg.status === 'sending' ? (
                                  <Loader2 className="w-3 h-3 animate-spin" style={{color:'var(--muted)'}} />
                                ) : msg.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5" style={{color:'#3a76f0'}} />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5" style={{color:'var(--muted)'}} />
                                ) : (
                                  <Check className="w-3.5 h-3.5" style={{color:'var(--muted)'}} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* ── Regular message bubble ── */
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'rounded-tr-none shadow-md' : 'rounded-tl-none'}`}
                          style={isMe 
                            ? {backgroundColor:'var(--bubble-me)',color:'#fff'} 
                            : {backgroundColor:'var(--bubble-them)',color:'var(--bubble-them-text)',border:'1px solid var(--bubble-them-border)'}}
                        >
                          {msg.attachment_url && (
                            <div className="mt-1 mb-2">
                              {msg.attachment_type === 'image' ? (
                                <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={msg.attachment_url} 
                                    alt="Attachment" 
                                    className="max-w-[240px] rounded-lg max-h-[200px] object-cover border border-black/10 hover:opacity-90 transition cursor-pointer"
                                  />
                                </a>
                              ) : msg.attachment_type === 'video' ? (
                                <video src={msg.attachment_url} controls className="max-w-[240px] rounded-lg max-h-[200px] border border-black/10" />
                              ) : msg.attachment_type === 'audio' ? (
                                <audio src={msg.attachment_url} controls className="max-w-[220px]" />
                              ) : (
                                <a 
                                  href={msg.attachment_url} 
                                  target="_blank" 
                                  download 
                                  className="flex items-center gap-2 p-2 bg-black/10 hover:bg-black/20 rounded-lg text-xs font-semibold no-underline"
                                  style={{color: isMe ? '#fff' : 'var(--text)'}}
                                >
                                  <Download size={14} />
                                  <span className="truncate max-w-[150px]">Attachment File</span>
                                </a>
                              )}
                            </div>
                          )}
                          {msg.content && <p className="leading-relaxed break-words">{msg.content}</p>}
                          <div className="flex justify-end items-center space-x-1 mt-1" style={{fontSize:9,color:isMe?'rgba(255,255,255,0.65)':'var(--muted)'}}>
                            <span>{formatMessageTime(msg.created_at)}</span>
                            {isMe && (
                              <span>
                                {msg.status === 'sending' ? (
                                  <Loader2 className="w-3 h-3 animate-spin" style={{color:'rgba(255,255,255,0.5)'}} />
                                ) : msg.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5" style={{color:'#93c5fd'}} />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5" style={{color:'rgba(255,255,255,0.55)'}} />
                                ) : (
                                  <Check className="w-3.5 h-3.5" style={{color:'rgba(255,255,255,0.55)'}} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {isTypingMap[selectedConversation.id] && (
                <div className="flex items-center space-x-2 text-xs text-blue-400 italic">
                  <Loader2 className="animate-spin w-3.5 h-3.5 text-blue-400" />
                  <span>{isTypingMap[selectedConversation.id]}</span>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>

            {/* Composer form */}
            <form onSubmit={(e) => handleSendMessage(e)} className="p-4 border-t flex items-center space-x-3 flex-shrink-0 relative" style={{backgroundColor:'var(--surface)',borderColor:'var(--border)'}}>

              {/* ── Attachment Popover ── */}
              <div className="relative">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowAttachmentMenu(prev => !prev)}
                  className="h-11 w-11 rounded-xl flex items-center justify-center transition border"
                  style={{
                    borderColor: showAttachmentMenu ? '#3a76f0' : 'var(--border)',
                    color: showAttachmentMenu ? '#3a76f0' : 'var(--muted)',
                    backgroundColor: showAttachmentMenu ? 'rgba(58,118,240,0.10)' : 'var(--bg)',
                  }}
                  title="Attach"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </button>

                {/* Attachment Menu Popover */}
                {showAttachmentMenu && (
                  <>
                    {/* Backdrop to close */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowAttachmentMenu(false)} />

                    <div
                      className="absolute z-50 bottom-14 left-0"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 18,
                        padding: '10px 14px',
                        display: 'flex',
                        gap: 14,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {/* Image */}
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                        <button
                          type="button"
                          onClick={() => { imageInputRef.current?.click(); }}
                          style={{
                            width:52, height:52, borderRadius:16,
                            background:'rgba(34,197,94,0.12)',
                            border:'none', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'background 0.15s',
                          }}
                          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(34,197,94,0.22)'}
                          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(34,197,94,0.12)'}
                          title="Image"
                        >
                          <ImageIcon size={24} color="#22c55e" />
                        </button>
                        <span style={{fontSize:10,color:'var(--muted)',fontWeight:500}}>Image</span>
                      </div>

                      {/* Video */}
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                        <button
                          type="button"
                          onClick={() => { videoInputRef.current?.click(); }}
                          style={{
                            width:52, height:52, borderRadius:16,
                            background:'rgba(168,85,247,0.12)',
                            border:'none', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'background 0.15s',
                          }}
                          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(168,85,247,0.22)'}
                          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(168,85,247,0.12)'}
                          title="Video"
                        >
                          <Video size={24} color="#a855f7" />
                        </button>
                        <span style={{fontSize:10,color:'var(--muted)',fontWeight:500}}>Video</span>
                      </div>

                      {/* Document */}
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                        <button
                          type="button"
                          onClick={() => { docInputRef.current?.click(); }}
                          style={{
                            width:52, height:52, borderRadius:16,
                            background:'rgba(251,146,60,0.12)',
                            border:'none', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'background 0.15s',
                          }}
                          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(251,146,60,0.22)'}
                          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(251,146,60,0.12)'}
                          title="Document"
                        >
                          <FileText size={24} color="#fb923c" />
                        </button>
                        <span style={{fontSize:10,color:'var(--muted)',fontWeight:500}}>Document</span>
                      </div>

                      {/* Poll */}
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                        <button
                          type="button"
                          onClick={() => { setShowAttachmentMenu(false); setShowPollModal(true); }}
                          style={{
                            width:52, height:52, borderRadius:16,
                            background:'rgba(58,118,240,0.12)',
                            border:'none', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'background 0.15s',
                          }}
                          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(58,118,240,0.22)'}
                          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background='rgba(58,118,240,0.12)'}
                          title="Poll"
                        >
                          <BarChart3 size={24} color="#3a76f0" />
                        </button>
                        <span style={{fontSize:10,color:'var(--muted)',fontWeight:500}}>Poll</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Hidden file inputs */}
              <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, fileInputRef)} style={{display:'none'}} />
              <input type="file" accept="image/*" ref={imageInputRef} onChange={(e) => handleFileUpload(e, imageInputRef)} style={{display:'none'}} />
              <input type="file" accept="video/*" ref={videoInputRef} onChange={(e) => handleFileUpload(e, videoInputRef)} style={{display:'none'}} />
              <input type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx" ref={docInputRef} onChange={(e) => handleFileUpload(e, docInputRef)} style={{display:'none'}} />

              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="New Message"
                className="flex-1 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                style={{backgroundColor:'var(--bg)',color:'var(--text)',border:'1px solid var(--border)'}}
              />
              <button
                type="submit"
                disabled={!inputText.trim() && !uploading}
                className="h-11 w-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="mb-6" style={{opacity:0.85}}>
              <SignalLogo size={72} color="#3a76f0" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{color:'var(--text)'}}>Welcome to Signal</h3>
            <p className="text-sm max-w-sm mb-4" style={{color:'var(--muted)'}}>
              Select a conversation from the panel to start messaging, or compose a new message.
            </p>
          </div>
        )}
      </div>

      {/* 4. Group Info Drawer Panel */}
      {showMembersPanel && selectedConversation && selectedConversation.type === 'group' && (
        <div className="w-64 flex flex-col flex-shrink-0" style={{backgroundColor:'var(--surface)',borderLeft:'1px solid var(--border)'}}>
          <div className="p-4 flex items-center justify-between" style={{borderBottom:'1px solid var(--border)'}}>
            <h3 className="font-bold text-sm" style={{color:'var(--text)'}}>Group Members</h3>
            <button
              onClick={() => setShowMembersPanel(false)}
              className="p-1 rounded"
              style={{color:'var(--muted)',background:'transparent',border:'none',cursor:'pointer'}}
              onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor='var(--surface2)'}
              onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor='transparent'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedConversation.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center space-x-3 p-1.5 rounded-lg"
                style={{cursor:'default'}}
                onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.backgroundColor='var(--surface2)'}
                onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.backgroundColor='transparent'}
              >
                {renderAvatar(member.user.avatar_url, member.user.display_name, 'w-8 h-8')}
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{color:'var(--text)'}}>{member.user.display_name}</p>
                  <p className="text-[9px] font-mono" style={{color:'var(--muted)'}}>@{member.user.phone_or_username}</p>
                </div>
                {member.role === 'admin' && (
                  <span className="ml-auto text-[8px] font-bold uppercase px-1.5 py-0.5 rounded" style={{background:'rgba(58,118,240,0.12)',color:'#3a76f0',border:'1px solid rgba(58,118,240,0.25)'}}>
                    Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals Mounting */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        user={currentUser}
        onAvatarChange={(url) => setCurrentUser(prev => prev ? { ...prev, avatar_url: url } : prev)}
      />
      <NewChatModal 
        isOpen={showNewChat} 
        onClose={() => setShowNewChat(false)} 
        onConversationCreated={handleConversationCreated} 
      />
      <PlaceholderPanel 
        type={placeholderType} 
        onClose={() => setPlaceholderType(null)} 
      />

      {/* ── Poll Builder Modal ── */}
      {showPollModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{backgroundColor:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)'}}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPollModal(false); }}
        >
          <div
            style={{
              background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:22, padding:28, width:380, boxShadow:'0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:'rgba(58,118,240,0.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <BarChart3 size={18} color="#3a76f0" />
                </div>
                <span style={{fontWeight:700,fontSize:16,color:'var(--text)'}}>Create Poll</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                style={{background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:4,borderRadius:8}}
                onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color='var(--text)'}
                onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color='var(--muted)'}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendPoll}>
              {/* Question */}
              <label style={{fontSize:11,fontWeight:600,color:'var(--muted)',letterSpacing:'0.06em',display:'block',marginBottom:6}}>QUESTION</label>
              <input
                type="text"
                placeholder="Ask a question..."
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                required
                style={{
                  width:'100%', padding:'10px 14px', borderRadius:12,
                  background:'var(--bg)', border:'1px solid var(--border)',
                  color:'var(--text)', fontSize:14, outline:'none',
                  boxSizing:'border-box', marginBottom:20,
                }}
                onFocus={e=>(e.currentTarget as HTMLInputElement).style.borderColor='#3a76f0'}
                onBlur={e=>(e.currentTarget as HTMLInputElement).style.borderColor='var(--border)'}
              />

              {/* Options */}
              <label style={{fontSize:11,fontWeight:600,color:'var(--muted)',letterSpacing:'0.06em',display:'block',marginBottom:8}}>OPTIONS</label>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                {pollOptions.map((opt, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{
                      width:22, height:22, borderRadius:6, background:'rgba(58,118,240,0.12)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      flexShrink:0, fontSize:11, fontWeight:700, color:'#3a76f0',
                    }}>{i+1}</div>
                    <input
                      type="text"
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                      required={i < 2}
                      style={{
                        flex:1, padding:'9px 12px', borderRadius:10,
                        background:'var(--bg)', border:'1px solid var(--border)',
                        color:'var(--text)', fontSize:13, outline:'none',
                      }}
                      onFocus={e=>(e.currentTarget as HTMLInputElement).style.borderColor='#3a76f0'}
                      onBlur={e=>(e.currentTarget as HTMLInputElement).style.borderColor='var(--border)'}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                        style={{background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2,borderRadius:6}}
                        onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color='#ef4444'}
                        onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color='var(--muted)'}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add option button */}
              {pollOptions.length < 6 && (
                <button
                  type="button"
                  onClick={() => setPollOptions(prev => [...prev, ''])}
                  style={{
                    width:'100%', padding:'8px 12px', borderRadius:10,
                    background:'transparent', border:'1px dashed var(--border)',
                    color:'var(--muted)', fontSize:12, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    marginBottom:20, transition:'border-color 0.15s',
                  }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#3a76f0';(e.currentTarget as HTMLButtonElement).style.color='#3a76f0';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--border)';(e.currentTarget as HTMLButtonElement).style.color='var(--muted)';}}
                >
                  + Add Option
                </button>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!pollQuestion.trim() || pollOptions.filter(o=>o.trim()).length < 2}
                style={{
                  width:'100%', padding:'11px 0', borderRadius:12,
                  background:'#3a76f0', border:'none', color:'#fff',
                  fontSize:14, fontWeight:700, cursor:'pointer',
                  transition:'background 0.15s',
                  opacity: (!pollQuestion.trim() || pollOptions.filter(o=>o.trim()).length < 2) ? 0.5 : 1,
                }}
                onMouseEnter={e=>{if(pollQuestion.trim() && pollOptions.filter(o=>o.trim()).length >= 2)(e.currentTarget as HTMLButtonElement).style.background='#2563eb';}}
                onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background='#3a76f0'}
              >
                Send Poll
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
