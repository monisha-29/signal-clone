/**
 * websocket.ts
 * 
 * Manages the WebSocket connection to the backend for real-time messaging,
 * typing indicators, and read receipts. Includes auto-reconnection logic.
 */

/** Callback type for WebSocket event listeners. */
type SocketCallback = (data: any) => void;

/**
 * WebSocketClient
 * 
 * A singleton class that wraps the native WebSocket API, managing state,
 * event distribution, and automatic reconnection.
 */
class WebSocketClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private listeners: Set<SocketCallback> = new Set();
  private reconnectTimeout: any = null;
  private url = 'ws://localhost:8000/api/ws';

  /**
   * Establishes a WebSocket connection using the provided auth token.
   * Closes any existing connection first.
   * 
   * @param token - The JWT access token for authentication.
   */
  connect(token: string) {
    this.token = token;
    if (this.socket) {
      this.socket.close();
    }

    const socketUrl = `${this.url}?token=${encodeURIComponent(token)}`;
    this.socket = new WebSocket(socketUrl);

    this.socket.onopen = () => {
      console.log('WebSocket Connection Established');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = jsonParse(event.data);
        if (data) {
          this.listeners.forEach((listener) => listener(data));
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket Connection Closed:', event.reason);
      // Attempt reconnect if we have a token and it wasn't a clean close
      if (this.token && event.code !== 1000) {
        this.reconnectTimeout = setTimeout(() => {
          this.connect(this.token!);
        }, 3000);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };
  }

  /**
   * Gracefully closes the WebSocket connection and cleans up timeouts/state.
   */
  disconnect() {
    this.token = null;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close(1000, 'User logged out');
      this.socket = null;
    }
  }

  /**
   * Subscribes a callback function to receive incoming WebSocket messages.
   * 
   * @param callback - The function to call when a message is received.
   * @returns A cleanup function to unsubscribe the callback.
   */
  subscribe(callback: SocketCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Sends a new chat message over the WebSocket.
   * 
   * @param conversationId - The ID of the conversation.
   * @param content - The text content of the message.
   * @param attachmentUrl - Optional URL of an attachment.
   * @param attachmentType - Optional type of the attachment.
   */
  sendMessage(conversationId: number, content: string, attachmentUrl?: string | null, attachmentType?: string | null) {
    this.send({
      event: 'message',
      conversation_id: conversationId,
      content,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    });
  }

  sendTyping(conversationId: number, isTyping: boolean) {
    this.send({
      event: 'typing',
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }

  sendReadReceipt(conversationId: number) {
    this.send({
      event: 'read_receipt',
      conversation_id: conversationId,
    });
  }

  private send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send WS event: Socket not open');
    }
  }
}

/**
 * Safely parses a JSON string, returning null if parsing fails.
 * 
 * @param str - The JSON string to parse.
 * @returns The parsed object, or null.
 */
function jsonParse(str: string) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

export const wsClient = new WebSocketClient();
