"""
Conversations router module.
Handles endpoints for listing conversations, creating direct chats, and creating group chats.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from datetime import datetime
from backend.app.core.db import get_db
from backend.app.core.security import get_current_user
from backend.app.models import User, Conversation, ConversationMember, Message
from backend.app.schemas import ConversationResponse, GroupCreate

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

@router.get("", response_model=List[ConversationResponse])
def list_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    List all conversations the current user is a part of.
    Calculates unread message counts and formats direct conversation names dynamically.
    
    Args:
        current_user: The authenticated user.
        db: Database session.
        
    Returns:
        A list of conversation objects with metadata like unread counts and last messages.
    """
    # Find all conversations current user is a member of
    memberships = db.query(ConversationMember).filter(ConversationMember.user_id == current_user.id).all()
    conversation_ids = [m.conversation_id for m in memberships]
    
    # Fetch conversation details ordered by the most recent activity
    conversations = db.query(Conversation).filter(
        Conversation.id.in_(conversation_ids)
    ).order_by(desc(Conversation.last_message_at)).all()
    
    response_list = []
    for conv in conversations:
        # Get all members of the conversation
        members = db.query(ConversationMember).filter(ConversationMember.conversation_id == conv.id).all()
        
        # Get the latest message for preview purposes
        last_msg = db.query(Message).filter(Message.conversation_id == conv.id).order_by(desc(Message.created_at)).first()
        
        # Find current user's membership to calculate unread messages
        user_membership = next((m for m in members if m.user_id == current_user.id), None)
        unread_count = 0
        if user_membership:
            if user_membership.last_read_message_id:
                # Count messages newer than the last read message
                unread_count = db.query(func.count(Message.id)).filter(
                    Message.conversation_id == conv.id,
                    Message.id > user_membership.last_read_message_id
                ).scalar() or 0
            else:
                # Count all messages in this conversation if none have been read
                unread_count = db.query(func.count(Message.id)).filter(
                    Message.conversation_id == conv.id
                ).scalar() or 0
                
        # For direct conversations, set dynamic name and avatar based on the other participant
        conv_name = conv.name
        conv_avatar = conv.avatar_url
        if conv.type == "direct":
            other_member = next((m for m in members if m.user_id != current_user.id), None)
            if other_member:
                conv_name = other_member.user.display_name
                conv_avatar = other_member.user.avatar_url
            else:
                # If no other member, it's a self-chat
                conv_name = "Notes to Self"
                conv_avatar = current_user.avatar_url
                
        response_list.append({
            "id": conv.id,
            "type": conv.type,
            "name": conv_name,
            "avatar_url": conv_avatar,
            "created_at": conv.created_at,
            "last_message_at": conv.last_message_at,
            "members": members,
            "last_message": last_msg,
            "unread_count": unread_count
        })
        
    return response_list

@router.post("/direct", response_model=ConversationResponse)
def get_or_create_direct(other_user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get an existing direct conversation with another user or create a new one.
    
    Args:
        other_user_id: The ID of the user to chat with.
        current_user: The authenticated user.
        db: Database session.
        
    Returns:
        The direct conversation details.
    """
    # Check if direct conversation already exists between current_user and other_user_id
    if other_user_id == current_user.id:
        # Notes to self: handled normally below by adding only one member
        pass
        
    # Query conversations of type "direct" that have exactly these two users (or one if self)
    subquery = db.query(ConversationMember.conversation_id).filter(
        ConversationMember.user_id.in_([current_user.id, other_user_id])
    ).group_by(ConversationMember.conversation_id).having(func.count(ConversationMember.user_id) == (2 if other_user_id != current_user.id else 1)).all()
    
    existing_conv_ids = [r[0] for r in subquery]
    
    direct_conv = db.query(Conversation).filter(
        Conversation.id.in_(existing_conv_ids),
        Conversation.type == "direct"
    ).first()
    
    if direct_conv:
        # Conversation exists; fetch members and return
        members = db.query(ConversationMember).filter(ConversationMember.conversation_id == direct_conv.id).all()
        last_msg = db.query(Message).filter(Message.conversation_id == direct_conv.id).order_by(desc(Message.created_at)).first()
        
        conv_name = None
        conv_avatar = None
        other_member = next((m for m in members if m.user_id != current_user.id), None)
        if other_member:
            conv_name = other_member.user.display_name
            conv_avatar = other_member.user.avatar_url
        else:
            conv_name = "Notes to Self"
            conv_avatar = current_user.avatar_url
            
        return {
            "id": direct_conv.id,
            "type": direct_conv.type,
            "name": conv_name,
            "avatar_url": conv_avatar,
            "created_at": direct_conv.created_at,
            "last_message_at": direct_conv.last_message_at,
            "members": members,
            "last_message": last_msg,
            "unread_count": 0
        }
        
    # Create new conversation since one does not exist
    new_conv = Conversation(type="direct")
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    
    # Add participants to the new conversation
    member1 = ConversationMember(conversation_id=new_conv.id, user_id=current_user.id, role="member")
    db.add(member1)
    if other_user_id != current_user.id:
        member2 = ConversationMember(conversation_id=new_conv.id, user_id=other_user_id, role="member")
        db.add(member2)
    db.commit()
    
    members = db.query(ConversationMember).filter(ConversationMember.conversation_id == new_conv.id).all()
    
    conv_name = None
    conv_avatar = None
    other_member = next((m for m in members if m.user_id != current_user.id), None)
    if other_member:
        conv_name = other_member.user.display_name
        conv_avatar = other_member.user.avatar_url
    else:
        conv_name = "Notes to Self"
        conv_avatar = current_user.avatar_url
        
    return {
        "id": new_conv.id,
        "type": new_conv.type,
        "name": conv_name,
        "avatar_url": conv_avatar,
        "created_at": new_conv.created_at,
        "last_message_at": new_conv.last_message_at,
        "members": members,
        "last_message": None,
        "unread_count": 0
    }

@router.post("/group", response_model=ConversationResponse)
def create_group(group_in: GroupCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Create a new group conversation with the specified members.
    
    Args:
        group_in: Group creation payload containing name and member IDs.
        current_user: The authenticated user who will become the group admin.
        db: Database session.
        
    Returns:
        The newly created group conversation.
    """
    # Create group conversation with a default avatar if none provided
    avatar = group_in.avatar_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={group_in.name}"
    new_conv = Conversation(
        type="group",
        name=group_in.name,
        avatar_url=avatar
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    
    # Add the user who created the group as an admin
    creator_member = ConversationMember(
        conversation_id=new_conv.id,
        user_id=current_user.id,
        role="admin"
    )
    db.add(creator_member)
    
    # Add other requested members to the group (avoiding double-adding the creator)
    for m_id in set(group_in.member_ids):
        if m_id != current_user.id:
            member = ConversationMember(
                conversation_id=new_conv.id,
                user_id=m_id,
                role="member"
            )
            db.add(member)
            
    db.commit()
    
    members = db.query(ConversationMember).filter(ConversationMember.conversation_id == new_conv.id).all()
    
    return {
        "id": new_conv.id,
        "type": new_conv.type,
        "name": new_conv.name,
        "avatar_url": new_conv.avatar_url,
        "created_at": new_conv.created_at,
        "last_message_at": new_conv.last_message_at,
        "members": members,
        "last_message": None,
        "unread_count": 0
    }
