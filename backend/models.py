"""
Pydantic models for recordings API
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class TranscriptSegment(BaseModel):
    """Transcript segment with timing information"""
    text: str
    start_time: float = Field(description="Start time in seconds")
    end_time: float = Field(description="End time in seconds")
    confidence: Optional[float] = None
    is_final: bool = True


class RecordingCreate(BaseModel):
    """Model for creating a new recording"""
    title: str = "Untitled Recording"
    duration_seconds: Optional[int] = None
    transcripts: List[TranscriptSegment] = []


class RecordingUpdate(BaseModel):
    """Model for updating recording metadata"""
    title: Optional[str] = None


class RecordingResponse(BaseModel):
    """Response model for recording data"""
    id: UUID
    user_id: UUID
    title: str
    audio_url: Optional[str]
    duration_seconds: Optional[int]
    created_at: datetime
    updated_at: datetime
    transcripts: Optional[List[TranscriptSegment]] = None


class LiveShareCreate(BaseModel):
    """Model for creating a live share"""
    recording_id: UUID
    expires_in_hours: Optional[int] = 24  # Default 24 hours


class LiveShareResponse(BaseModel):
    """Response model for live share"""
    id: UUID
    recording_id: UUID
    share_token: str
    is_active: bool
    expires_at: Optional[datetime]
    viewer_count: int
    shareurl: str


class ShareViewResponse(BaseModel):
    """Response for public share view"""
    title: str
    created_at: datetime
    transcripts: List[TranscriptSegment]
    is_live: bool
    audio_url: Optional[str] = None
