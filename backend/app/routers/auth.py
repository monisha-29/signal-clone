"""
Authentication router module.
Handles endpoints for user registration, login, logout, and fetching the current user.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import create_access_token, get_current_user
from app.models import User
from app.schemas import UserCreate, UserLogin, Token, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    Checks if the phone or username is already registered and creates a new user object.
    
    Args:
        user_in: The user creation payload.
        db: Database session.
    
    Returns:
        The newly created user object.
    """
    # Check if a user with the same phone or username already exists
    db_user = db.query(User).filter(User.phone_or_username == user_in.phone_or_username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or phone number already registered"
        )
    
    # Generate a default avatar if none is provided
    avatar = user_in.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={user_in.phone_or_username}"
    
    # Create and store the new user
    user = User(
        phone_or_username=user_in.phone_or_username,
        display_name=user_in.display_name,
        avatar_url=avatar,
        status="online"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login")
def login(login_in: UserLogin, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate a user and create a session.
    Validates the OTP and sets an HTTP-only cookie with the JWT access token.
    
    Args:
        login_in: The login payload containing username/phone and OTP.
        response: FastAPI response object to set the cookie.
        db: Database session.
        
    Returns:
        A dictionary containing the access token, token type, and user information.
    """
    # Verify OTP: accept "123456" or any 6-digit OTP
    if len(login_in.otp) != 6 or not login_in.otp.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP format. Must be a 6-digit code."
        )
    
    # Real login check: find the user by phone or username
    user = db.query(User).filter(User.phone_or_username == login_in.phone_or_username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered. Please register first."
        )
    
    # Update status to online on successful login
    user.status = "online"
    db.commit()
    db.refresh(user)
    
    # Create JWT token for the session
    access_token = create_access_token(data={"sub": user.phone_or_username})
    
    # Set httponly cookie to store the JWT securely
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=3600 * 24 * 7,  # 7 days validity
        samesite="lax",
        secure=False  # Allow http locally (should be True in production)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/logout")
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    """
    Log out the current user.
    Sets the user's status to offline and deletes the access token cookie.
    
    Args:
        response: FastAPI response object.
        request: FastAPI request object.
        db: Database session.
        
    Returns:
        A dictionary confirming successful logout.
    """
    # Mark user offline if logged in by silently attempting to retrieve them
    try:
        user = get_current_user(request, db)
        if user:
            user.status = "offline"
            db.commit()
    except Exception:
        # Ignore errors if user is not authenticated or token is invalid
        pass
        
    # Remove the access token cookie
    response.delete_cookie(
        key="access_token",
        samesite="lax",
        secure=False
    )
    return {"detail": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieve the current authenticated user's profile.
    
    Args:
        current_user: The authenticated user object provided by dependency injection.
        
    Returns:
        The current user.
    """
    return current_user
