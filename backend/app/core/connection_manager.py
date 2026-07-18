"""
WebSocket connection management.

This module provides a ConnectionManager class to handle active WebSocket
connections, room memberships, and broadcasting messages to users.
"""
from fastapi import WebSocket
from typing import Dict, List, Set
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Manages active WebSocket connections for users and handles message routing.
    """
    def __init__(self):
        # Maps user_id -> list of active WebSockets (allows multi-tab)
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Maps conversation_id -> set of active user_ids
        self.room_members: Dict[int, Set[int]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        """
        Accepts a new WebSocket connection and associates it with a user.
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected. Active connections count: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: int, websocket: WebSocket):
        """
        Removes a WebSocket connection when it is closed or broken.
        """
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected.")

    async def send_personal_message(self, message: dict, user_id: int):
        """
        Sends a direct message to all active WebSocket connections for a specific user.
        """
        if user_id in self.active_connections:
            websockets = self.active_connections[user_id]
            for ws in list(websockets):
                try:
                    await ws.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    # Clean up broken socket
                    self.disconnect(user_id, ws)

    async def broadcast_to_conversation(self, conversation_id: int, message: dict, member_ids: List[int]):
        """
        Broadcast a message/event to all active members of a conversation.
        """
        for user_id in member_ids:
            await self.send_personal_message(message, user_id)

# Global connection manager instance
manager = ConnectionManager()
