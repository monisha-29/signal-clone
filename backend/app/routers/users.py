"""
Users router module.
Handles endpoints for searching users and managing contacts.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.db import get_db
from app.core.security import get_current_user
from app.models import User, Contact
from app.schemas import UserResponse, ContactResponse, ContactCreate

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/search", response_model=List[UserResponse])
def search_users(q: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Search for users by display name or username.
    
    Args:
        q: The search query string.
        current_user: The authenticated user making the request.
        db: Database session.
        
    Returns:
        A list of matching users (excluding the current user).
    """
    if not q:
        return []
    # Search by display name or username with partial matching, excluding the current user
    results = db.query(User).filter(
        (User.phone_or_username.ilike(f"%{q}%")) | (User.display_name.ilike(f"%{q}%"))
    ).filter(User.id != current_user.id).limit(10).all()
    return results

@router.get("/contacts", response_model=List[ContactResponse])
def get_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Retrieve the contact list for the current user.
    
    Args:
        current_user: The authenticated user.
        db: Database session.
        
    Returns:
        A list of the user's saved contacts.
    """
    return db.query(Contact).filter(Contact.owner_id == current_user.id).all()

@router.post("/contacts", response_model=ContactResponse)
def add_contact(contact_in: ContactCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Add a new user to the current user's contact list.
    
    Args:
        contact_in: Payload containing the username of the contact to add.
        current_user: The authenticated user.
        db: Database session.
        
    Returns:
        The newly created contact entry.
    """
    # Look up the user to be added
    contact_user = db.query(User).filter(User.phone_or_username == contact_in.contact_username).first()
    if not contact_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    # Prevent adding oneself as a contact
    if contact_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add yourself as a contact"
        )
    
    # Check if the contact relationship already exists
    existing = db.query(Contact).filter(
        Contact.owner_id == current_user.id,
        Contact.contact_user_id == contact_user.id
    ).first()
    if existing:
        return existing
        
    # Create and store the new contact relation
    contact = Contact(owner_id=current_user.id, contact_user_id=contact_user.id)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact
