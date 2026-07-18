"""
WebSocket router module.
Handles real-time messaging, typing indicators, read receipts, and simulates auto-replies.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import json
import datetime
from app.core.db import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.core.connection_manager import manager
from app.models import User, Conversation, ConversationMember, Message, MessageReceipt

router = APIRouter(tags=["ws"])

def get_ws_user(token: str, db: Session) -> User:
    """
    Authenticate a WebSocket connection using a JWT token.
    
    Args:
        token: The JWT access token.
        db: Database session.
        
    Returns:
        The authenticated User object, or None if validation fails.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            return None
        return db.query(User).filter(User.phone_or_username == username).first()
    except JWTError:
        return None

@router.websocket("/api/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for handling real-time chat events.
    Manages connections, disconnections, messaging, typing status, and read receipts.
    
    Args:
        websocket: The active WebSocket connection.
        token: The authentication token passed via query parameters.
        db: Database session.
    """
    user = get_ws_user(token, db)
    if not user:
        await websocket.close(code=1008)  # Policy Violation due to invalid token
        return

    await manager.connect(user.id, websocket)

    try:
        # On connection, notify online status of user by updating database
        user.status = "online"
        db.commit()

        while True:
            # Receive incoming text data from the client
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue

            event_type = payload.get("event")
            conversation_id = payload.get("conversation_id")
            
            if not conversation_id:
                continue

            # Verify that the sender is actually a member of the conversation
            member = db.query(ConversationMember).filter(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user.id
            ).first()
            if not member:
                continue

            # Fetch all active members of the conversation for broadcasting
            conv_members = db.query(ConversationMember).filter(
                ConversationMember.conversation_id == conversation_id
            ).all()
            member_ids = [m.user_id for m in conv_members]

            if event_type == "message":
                content = payload.get("content")
                attachment_url = payload.get("attachment_url")
                attachment_type = payload.get("attachment_type")
                if not content and not attachment_url:
                    continue

                # Save the new message to the DB
                new_msg = Message(
                    conversation_id=conversation_id,
                    sender_id=user.id,
                    content=content or "",
                    attachment_url=attachment_url,
                    attachment_type=attachment_type,
                    status="sent"
                )
                db.add(new_msg)
                db.commit()
                db.refresh(new_msg)

                # Update the conversation's last activity timestamp
                conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
                if conv:
                    conv.last_message_at = datetime.datetime.utcnow()
                    db.commit()

                # Automatically update the last read message ID for the sender
                member.last_read_message_id = new_msg.id
                db.commit()

                # Check which other members are currently online to set initial message delivery status
                online_other_members = []
                for om in conv_members:
                    if om.user_id != user.id and om.user_id in manager.active_connections:
                        online_other_members.append(om.user_id)

                if online_other_members:
                    # If any other member is online, mark message as delivered globally
                    new_msg.status = "delivered"
                    for om_id in online_other_members:
                        # Write delivery receipt for each online member
                        rc = MessageReceipt(
                            message_id=new_msg.id,
                            user_id=om_id,
                            status="delivered"
                        )
                        db.add(rc)
                    db.commit()

                # Broadcast the newly created message to all members
                broadcast_payload = {
                    "event": "message",
                    "conversation_id": conversation_id,
                    "message": {
                        "id": new_msg.id,
                        "conversation_id": new_msg.conversation_id,
                        "sender_id": new_msg.sender_id,
                        "sender_name": user.display_name,
                        "content": new_msg.content,
                        "attachment_url": new_msg.attachment_url,
                        "attachment_type": new_msg.attachment_type,
                        "created_at": new_msg.created_at.isoformat(),
                        "status": new_msg.status
                    }
                }
                await manager.broadcast_to_conversation(conversation_id, broadcast_payload, member_ids)

                # ─── Mock Receiving Auto-Replies ───
                # Look up other members in this conversation to send a simulated reply
                other_members = [m for m in conv_members if m.user_id != user.id]
                if other_members:
                    # Pick the first other member to act as the responder
                    responder_member = other_members[0]
                    responder = db.query(User).filter(User.id == responder_member.user_id).first()
                    
                    if responder:
                        import asyncio
                        
                        async def mock_reply_task(conv_id: int, resp_id: int, resp_name: str, user_content: str, m_ids: list):
                            """
                            Asynchronous task that simulates a user typing and sending a reply.
                            """
                            # Step 1: Wait a brief moment, then send an "is typing" indicator
                            await asyncio.sleep(1.5)
                            
                            # Broadcast typing indicator
                            await manager.broadcast_to_conversation(conv_id, {
                                "event": "typing",
                                "conversation_id": conv_id,
                                "user_id": resp_id,
                                "username": resp_name,
                                "is_typing": True
                            }, m_ids)
                            
                            # Step 2: Wait for simulated typing delay
                            await asyncio.sleep(2.0)
                            
                            # Stop typing indicator
                            await manager.broadcast_to_conversation(conv_id, {
                                "event": "typing",
                                "conversation_id": conv_id,
                                "user_id": resp_id,
                                "username": resp_name,
                                "is_typing": False
                            }, m_ids)
                            
                            # Step 3: Create the automatic text response
                            reply_content = f"Hey! I got your message: '{user_content}'."
                            
                            # Write response message to SQLite using a fresh session
                            from app.core.db import SessionLocal
                            session = SessionLocal()
                            try:
                                reply_msg = Message(
                                    conversation_id=conv_id,
                                    sender_id=resp_id,
                                    content=reply_content,
                                    status="delivered"
                                )
                                session.add(reply_msg)
                                # Update conversation's last message time again
                                cv = session.query(Conversation).filter(Conversation.id == conv_id).first()
                                if cv:
                                    cv.last_message_at = datetime.datetime.utcnow()
                                session.commit()
                                session.refresh(reply_msg)
                                
                                # Broadcast the simulated reply to everyone
                                await manager.broadcast_to_conversation(conv_id, {
                                    "event": "message",
                                    "conversation_id": conv_id,
                                    "message": {
                                        "id": reply_msg.id,
                                        "conversation_id": conv_id,
                                        "sender_id": resp_id,
                                        "sender_name": resp_name,
                                        "content": reply_msg.content,  # Reverted: No lock prefix
                                        "attachment_url": None,
                                        "attachment_type": None,
                                        "created_at": reply_msg.created_at.isoformat(),
                                        "status": "delivered"
                                    }
                                }, m_ids)
                            except Exception as ex:
                                import logging
                                logging.error(f"Error in mock auto-reply: {ex}")
                            finally:
                                session.close()
                                
                        # Run the asynchronous reply task in the background without blocking
                        asyncio.create_task(mock_reply_task(
                            conversation_id,
                            responder.id,
                            responder.display_name,
                            new_msg.content,
                            member_ids
                        ))

            elif event_type == "typing":
                # Handle typing indicator broadcasts
                is_typing = payload.get("is_typing", False)
                typing_payload = {
                    "event": "typing",
                    "conversation_id": conversation_id,
                    "user_id": user.id,
                    "username": user.display_name,
                    "is_typing": is_typing
                }
                # Send typing event only to the other members in the conversation
                other_member_ids = [mid for mid in member_ids if mid != user.id]
                await manager.broadcast_to_conversation(conversation_id, typing_payload, other_member_ids)

            elif event_type == "read_receipt":
                # Handle client-side read receipt notifications
                # Mark latest messages as read for this user
                latest_msg = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.id.desc()).first()
                if latest_msg:
                    member.last_read_message_id = latest_msg.id
                    
                    # Update receipts for all messages this user hadn't previously read
                    unread_messages = db.query(Message).filter(
                        Message.conversation_id == conversation_id,
                        Message.sender_id != user.id,
                        Message.id <= latest_msg.id
                    ).all()

                    for m in unread_messages:
                        existing = db.query(MessageReceipt).filter(
                            MessageReceipt.message_id == m.id,
                            MessageReceipt.user_id == user.id,
                            MessageReceipt.status == "read"
                        ).first()
                        if not existing:
                            rc = MessageReceipt(
                                message_id=m.id,
                                user_id=user.id,
                                status="read"
                            )
                            db.add(rc)
                            
                            # Check if everyone in the conversation has read it
                            other_members_to_read = [mid for mid in member_ids if mid != m.sender_id]
                            read_count = db.query(MessageReceipt).filter(
                                MessageReceipt.message_id == m.id,
                                MessageReceipt.status == "read"
                            ).count()
                            
                            # Upgrade message status if fully read
                            if read_count + 1 >= len(other_members_to_read):
                                m.status = "read"
                            else:
                                m.status = "delivered"
                    
                    db.commit()

                    # Broadcast the read receipt so clients can update UI checks
                    receipt_payload = {
                        "event": "read_receipt",
                        "conversation_id": conversation_id,
                        "user_id": user.id,
                        "last_read_message_id": latest_msg.id
                    }
                    await manager.broadcast_to_conversation(conversation_id, receipt_payload, member_ids)

    except WebSocketDisconnect:
        # Handle expected client disconnects
        manager.disconnect(user.id, websocket)
        # Mark user as offline in the database
        user.status = "offline"
        db.commit()
    except Exception as e:
        # Handle unexpected errors or crashes
        manager.disconnect(user.id, websocket)
        user.status = "offline"
        db.commit()
