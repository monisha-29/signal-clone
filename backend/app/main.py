"""
Main application module for the Signal Clone backend API.

This module initializes the FastAPI application, sets up CORS middleware,
configures static file serving for uploads, and registers all API routers.
"""
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import shutil
import uuid
from app.core.db import init_db, SessionLocal
from app.seed import seed_data
from app.routers import auth, users, conversations, messages, ws

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for the FastAPI application.

    Handles startup events like initializing the database tables and
    running the initial data seed script. Yields control to the app,
    and handles any necessary cleanup on shutdown (though none is needed here).
    """
    # Initialize DB tables
    init_db()
    
    # Run seed script
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
        
    yield

app = FastAPI(
    title="Signal Clone API",
    description="Backend API for Signal Clone messenger assignment",
    version="1.0.0",
    lifespan=lifespan
)

# Create upload directory inside project
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static_uploads", StaticFiles(directory=UPLOAD_DIR), name="static_uploads")

# CORS setup
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(ws.router)

@app.post("/api/upload")
def upload_file(file: UploadFile = File(...)):
    """
    Endpoint to handle file uploads.

    Generates a unique filename using UUID, saves the file to the static uploads
    directory, and returns the public URL and determined MIME type category
    (image, video, audio, or file).
    """
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return file access url
    file_url = f"http://localhost:8000/static_uploads/{unique_filename}"
    
    # Determine type category based on file extension
    mime_type = "file"
    if file_ext.lower() in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]:
        mime_type = "image"
    elif file_ext.lower() in [".mp4", ".webm", ".ogg"]:
        mime_type = "video"
    elif file_ext.lower() in [".mp3", ".wav", ".m4a"]:
        mime_type = "audio"
        
    return {
        "url": file_url,
        "filename": file.filename,
        "type": mime_type
    }

@app.get("/api/health")
def health_check():
    """
    Simple health check endpoint to verify the API is running.
    """
    return {"status": "healthy", "service": "signal-clone-backend"}
