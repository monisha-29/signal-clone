/**
 * api.ts
 * 
 * Provides a service layer for interacting with the backend REST API.
 * Handles authentication headers, error parsing, and structured requests.
 */
import { User, Conversation, Message, ContactResponse } from './types';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Core fetch wrapper that automatically attaches the authorization token
 * and sets default headers.
 * 
 * @param endpoint - The API endpoint to call (relative to API_BASE_URL).
 * @param options - Additional fetch options (method, body, etc.).
 * @returns The parsed JSON response, or null for 204 No Content.
 */
async function fetcher(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  let token = null;
  // Retrieve token from localStorage if executing in a browser environment
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('access_token');
  }

  // Set default credentials to include for cookies (httpOnly JWT sessions)
  options.credentials = 'include';
  options.headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(errorData.detail || 'API request failed');
  }

  // Handle empty responses
  if (response.status === 204) return null;
  return response.json();
}

/**
 * API client object containing all supported endpoint calls, grouped by domain.
 */
export const api = {
  // Auth
  register: (phone_or_username: string, display_name: string, avatar_url?: string): Promise<User> => {
    return fetcher('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone_or_username, display_name, avatar_url }),
    });
  },

  login: (phone_or_username: string, otp: string): Promise<{ access_token: string, token_type: string, user: User }> => {
    return fetcher('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone_or_username, otp }),
    });
  },

  logout: (): Promise<any> => {
    return fetcher('/api/auth/logout', { method: 'POST' });
  },

  me: (): Promise<User> => {
    return fetcher('/api/auth/me');
  },

  // Users & Contacts
  searchUsers: (q: string): Promise<User[]> => {
    return fetcher(`/api/users/search?q=${encodeURIComponent(q)}`);
  },

  getContacts: (): Promise<any[]> => {
    return fetcher('/api/users/contacts');
  },

  addContact: (contact_username: string): Promise<any> => {
    return fetcher('/api/users/contacts', {
      method: 'POST',
      body: JSON.stringify({ contact_username }),
    });
  },

  // Conversations
  getConversations: (): Promise<Conversation[]> => {
    return fetcher('/api/conversations');
  },

  createDirectChat: (other_user_id: number): Promise<Conversation> => {
    return fetcher(`/api/conversations/direct?other_user_id=${other_user_id}`, {
      method: 'POST',
    });
  },

  createGroupChat: (name: string, member_ids: number[], avatar_url?: string): Promise<Conversation> => {
    return fetcher('/api/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ name, member_ids, avatar_url }),
    });
  },

  // Messages
  getMessages: (conversation_id: number): Promise<Message[]> => {
    return fetcher(`/api/messages/${conversation_id}`);
  },

  markAsRead: (conversation_id: number): Promise<any> => {
    return fetcher(`/api/messages/${conversation_id}/read`, {
      method: 'POST',
    });
  },

  uploadFile: (file: File): Promise<{ url: string; filename: string; type: 'image' | 'video' | 'audio' | 'file' }> => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('http://localhost:8000/api/upload', {
      method: 'POST',
      body: formData,
    }).then((res) => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    });
  },
};
