"""
Messages router module.
Handles endpoints for fetching conversation messages and marking messages as read.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List
import datetime
from app.core.db import get_db
from app.core.security import get_current_user
from app.models import User, Conversation, ConversationMember, Message, MessageReceipt
from app.schemas import MessageResponse

router = APIRouter(prefix="/api/messages", tags=["messages"])

@router.get("/{conversation_id}", response_model=List[MessageResponse])
def get_messages(conversation_id: int, limit: int = 100, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetch messages for a specific conversation and update read statuses.
    
    Args:
        conversation_id: The ID of the conversation.
        limit: Maximum number of messages to retrieve.
        current_user: The authenticated user.
        db: Database session.
        
    Returns:
        A list of messages for the requested conversation.
    """
    # Verify user is a member of this conversation before fetching messages
    member = db.query(ConversationMember).filter(
        ConversationMember.conversation_id == conversation_id,
        ConversationMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
        
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(asc(Message.created_at)).limit(limit).all()
    
    # Mark messages as read by updating last_read_message_id and adding read receipts
    if messages:
        latest_msg = messages[-1]
        member.last_read_message_id = latest_msg.id
        
        # Insert read receipts for all messages the current user hasn't read yet (excluding their own)
        unreceipted_msgs = [m for m in messages if m.sender_id != current_user.id]
        for msg in unreceipted_msgs:
            # Check if a read receipt already exists to avoid duplicates
            existing_receipt = db.query(MessageReceipt).filter(
                MessageReceipt.message_id == msg.id,
                MessageReceipt.user_id == current_user.id,
                MessageReceipt.status == "read"
            ).first()
            
            if not existing_receipt:
                receipt = MessageReceipt(
                    message_id=msg.id,
                    user_id=current_user.id,
                    status="read",
                    timestamp=datetime.datetime.utcnow()
                )
                db.add(receipt)
                
                # Check if all other members have read the message to update its overall status
                other_members = db.query(ConversationMember).filter(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id != msg.sender_id
                ).all()
                
                # Count total read receipts for this message (excluding the original sender)
                read_receipts_count = db.query(MessageReceipt).filter(
                    MessageReceipt.message_id == msg.id,
                    MessageReceipt.status == "read"
                ).count()
                
                # If all recipients have read it, mark it as read globally; otherwise keep as delivered
                if read_receipts_count + 1 >= len(other_members):
                    msg.status = "read"
                elif msg.status != "read":
                    msg.status = "delivered"
                    
        db.commit()
        # Refetch messages to get updated statuses after creating receipts
        messages = db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(asc(Message.created_at)).limit(limit).all()
    return messages

@router.post("/{conversation_id}/read")
def mark_as_read(conversation_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Mark all unread messages in a conversation as read for the current user.
    
    Args:
        conversation_id: The ID of the conversation.
        current_user: The authenticated user.
        db: Database session.
        
    Returns:
        A status dictionary indicating success.
    """
    # Verify user is a member of the conversation
    member = db.query(ConversationMember).filter(
        ConversationMember.conversation_id == conversation_id,
        ConversationMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this conversation"
        )
        
    # Find the latest message in this conversation to update the high-water mark
    latest_msg = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(desc(Message.created_at)).first()
    if latest_msg:
        member.last_read_message_id = latest_msg.id
        
        # Identify all messages sent by others that need a read receipt
        unread_msgs = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.id <= latest_msg.id
        ).all()
        
        for msg in unread_msgs:
            # Create a read receipt if it doesn't already exist
            existing = db.query(MessageReceipt).filter(
                MessageReceipt.message_id == msg.id,
                MessageReceipt.user_id == current_user.id,
                MessageReceipt.status == "read"
            ).first()
            if not existing:
                rc = MessageReceipt(
                    message_id=msg.id,
                    user_id=current_user.id,
                    status="read"
                )
                db.add(rc)
                
                # Check if all other members have read it to update the global message status
                other_members = db.query(ConversationMember).filter(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id != msg.sender_id
                ).all()
                
                read_receipts_count = db.query(MessageReceipt).filter(
                    MessageReceipt.message_id == msg.id,
                    MessageReceipt.status == "read"
                ).count()
                
                if read_receipts_count + 1 >= len(other_members):
                    msg.status = "read"
                else:
                    msg.status = "delivered"
        db.commit()
    return {"status": "success"}
