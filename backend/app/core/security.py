"""
Security and authentication utilities.

This module provides functions for creating JWT access tokens and
extracting the current authenticated user from incoming requests.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models import User

SECRET_KEY = "signal_messenger_super_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Create a new JWT access token.
    
    Args:
        data: Dictionary of data to encode in the token.
        expires_delta: Optional custom expiration time.
        
    Returns:
        The encoded JWT token as a string.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    FastAPI dependency to get the currently authenticated user.
    
    Validates the JWT token from cookies or the Authorization header,
    and retrieves the corresponding user from the database.
    """
    token = request.cookies.get("access_token")
    if not token:
        # Check authorization header too just in case
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
        
    try:
        # Decode token to extract payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
        
    # Query database for the user found in token payload
    user = db.query(User).filter(User.phone_or_username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
