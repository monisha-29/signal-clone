/**
 * types.ts
 * 
 * Provides TypeScript interfaces for the core domain models used across the frontend,
 * including Users, Conversations, Messages, and related entities.
 */

/**
 * Represents a registered user in the application.
 */
export interface User {
  id: number;
  phone_or_username: string;
  display_name: string;
  avatar_url: string | null;
  status: 'online' | 'offline' | string;
  created_at: string;
}

/**
 * Represents a member within a conversation, linking a user to a conversation
 * with specific roles and tracking their last read message.
 */
export interface ConversationMember {
  id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_message_id: number | null;
  user: User;
}

/**
 * Represents a single chat message sent within a conversation.
 */
export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  attachment_url?: string | null;
  attachment_type?: 'image' | 'video' | 'audio' | 'file' | string | null;
  created_at: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  sender_name?: string; // Client-side display helper
}

/**
 * Represents a chat conversation. Can be a direct one-on-one chat or a group chat.
 */
export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_message_at: string;
  members: ConversationMember[];
  last_message: Message | null;
  unread_count: number;
}
