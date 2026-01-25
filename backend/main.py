from fastapi import FastAPI, WebSocket, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import asyncio
import json
from dotenv import load_dotenv
import websockets
from datetime import datetime, timedelta, timezone
from collections import deque
import time
import uuid
import httpx
import io
import wave
import struct
import secrets
from typing import Dict, List, Optional, Set
from models import (
    RecordingCreate, RecordingUpdate, RecordingResponse,
    LiveShareCreate, LiveShareResponse, ShareViewResponse,
    TranscriptSegment
)
load_dotenv()

# Debug mode
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

app = FastAPI()

# Setup file logging
def log_to_file(msg):
    with open("debug.log", "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().isoformat()}] {msg}\n")

# Override print to also log to file (simple hack for debugging)
original_print = print
def print(*args, **kwargs):
    msg = " ".join(map(str, args))
    log_to_file(msg)
    original_print(*args, **kwargs)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import payments
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

# Performance tracking class
class PerformanceMetrics:
    def __init__(self):
        self.chunks_sent = 0
        self.transcripts_received = 0
        self.total_bytes_sent = 0
        self.chunk_timestamps = deque(maxlen=100)  # Track last 100 chunks
        self.latencies = deque(maxlen=50)  # Track last 50 latencies
        self.start_time = time.time()
        self.last_chunk_time = None
        self.last_transcript_time = None
        
    def log_chunk_sent(self, size_bytes):
        self.chunks_sent += 1
        self.total_bytes_sent += size_bytes
        current_time = time.time()
        self.chunk_timestamps.append(current_time)
        self.last_chunk_time = current_time
        
    def log_transcript_received(self):
        self.transcripts_received += 1
        current_time = time.time()
        self.last_transcript_time = current_time
        
        # Calculate latency if we have a recent chunk
        if self.last_chunk_time:
            latency = (current_time - self.last_chunk_time) * 1000  # Convert to ms
            self.latencies.append(latency)
            return latency
        return None
    
    def get_chunks_per_second(self):
        if len(self.chunk_timestamps) < 2:
            return 0
        time_span = self.chunk_timestamps[-1] - self.chunk_timestamps[0]
        if time_span == 0:
            return 0
        return len(self.chunk_timestamps) / time_span
    
    def get_avg_latency(self):
        if not self.latencies:
            return 0
        return sum(self.latencies) / len(self.latencies)
    
    def get_stats_summary(self):
        runtime = time.time() - self.start_time
        return {
            "runtime_seconds": round(runtime, 1),
            "chunks_sent": self.chunks_sent,
            "transcripts_received": self.transcripts_received,
            "total_bytes": self.total_bytes_sent,
            "chunks_per_sec": round(self.get_chunks_per_second(), 2),
            "avg_latency_ms": round(self.get_avg_latency(), 2),
            "min_latency_ms": round(min(self.latencies), 2) if self.latencies else 0,
            "max_latency_ms": round(max(self.latencies), 2) if self.latencies else 0
        }

# Audio buffer class to store audio chunks during recording
class AudioBuffer:
    def __init__(self):
        self.chunks = []
        self.sample_rate = 16000
        self.channels = 1
        
    def add_chunk(self, chunk: bytes):
        """Add audio chunk to buffer"""
        self.chunks.append(chunk)
    
    def get_wav_bytes(self) -> bytes:
        """Convert buffered chunks to WAV file bytes"""
        if not self.chunks:
            return b""
        
        # Convert bytes to int16 array
        audio_data = b"".join(self.chunks)
        
        # Create WAV file in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(self.channels)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(self.sample_rate)
            wav_file.writeframes(audio_data)
        
        wav_buffer.seek(0)
        return wav_buffer.read()
    
    def get_duration_seconds(self) -> float:
        """Calculate total duration in seconds"""
        if not self.chunks:
            return 0.0
        total_bytes = sum(len(chunk) for chunk in self.chunks)
        # 16-bit = 2 bytes per sample
        total_samples = total_bytes // 2
        return total_samples / self.sample_rate
    
    def clear(self):
        """Clear all buffered chunks"""
        self.chunks = []

# Supabase client initialization
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

async def get_supabase_client(token: str):
    """Create Supabase client with user token"""
    return httpx.AsyncClient(
        base_url=SUPABASE_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json"
        }
    )

async def upload_to_supabase_storage(user_id: str, recording_id: str, audio_bytes: bytes, token: str, content_type: str = "audio/wav") -> str:
    """Upload audio file to Supabase Storage and return the storage path"""
    # Determine extension based on content_type
    ext = "webm" if "webm" in content_type else "wav"
    filename = f"{user_id}/{recording_id}.{ext}"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/recordings/{filename}",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_KEY,
                "x-upsert": "true" # Allow overwriting existing files
            },
            files={"file": (f"recording.{ext}", audio_bytes, content_type)}
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail=f"Storage upload failed: {response.text}")
        
        # Return internal storage path, NOT public URL
        return filename

async def create_signed_url(filename: str, token: str, expires_in: int = 3600) -> str:
    """Create a signed URL for a file in storage"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/recordings/{filename}",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_KEY,
                "Content-Type": "application/json"
            },
            json={"expiresIn": expires_in}
        )
        
        if response.status_code != 200:
            print(f"Failed to sign URL for {filename}: {response.text}")
            return None
            
        data = response.json()
        # The signedURL returned is relative to the Supabase URL
        return f"{SUPABASE_URL}/storage/v1{data['signedURL']}"

async def delete_from_supabase_storage(filename: str, token: str) -> None:
    """Delete a file from Supabase Storage (ignore missing)"""
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{SUPABASE_URL}/storage/v1/object/recordings/{filename}",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_KEY,
            }
        )
        if response.status_code not in [200, 204]:
            # Log but don't fail the entire request
            print(f"Storage delete warning for {filename}: {response.status_code} {response.text}")

# Active recording buffers (keyed by client_id)
active_buffers: Dict[str, AudioBuffer] = {}

# Active live share connections (keyed by share_token)
live_share_connections: Dict[str, List[WebSocket]] = {}



@app.get("/")
def read_root():
    return {"message": "Verbact Backend (Deepgram Direct) - Enhanced Monitoring"}

# ============== RECORDINGS API ==============

@app.post("/api/recordings/init")
async def init_recording(
    id: Optional[str] = Form(None),
    title: str = Form(...),
    token: str = Form(...)
):
    """Initialize a recording placeholder (for live sharing)"""
    try:
        # Verify user
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_KEY
                }
            )
            
            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_data = user_response.json()
            user_id = user_data["id"]
            
        recording_id = id if id else str(uuid.uuid4())
        
        async with await get_supabase_client(token) as supabase_client:
            recording_data = {
                "id": recording_id,
                "user_id": user_id,
                "title": title,
                "duration_seconds": 0,
                "audio_url": None
            }
            
            response = await supabase_client.post(
                "/rest/v1/recordings",
                json=recording_data,
                headers={"Prefer": "resolution=merge-duplicates"}
            )
            
            if response.status_code not in [200, 201, 204]:
                raise HTTPException(status_code=500, detail=f"Database error: {response.text}")
                
        return {"id": recording_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recordings")
async def create_recording(
    id: Optional[str] = Form(None),
    title: str = Form(...),
    duration_seconds: int = Form(...),
    audio_file: UploadFile = File(...),
    transcripts: str = Form(...),  # JSON string
    token: str = Form(...)
):
    """Save a new recording or update an existing one"""
    try:
        # Verify user token
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_KEY
                }
            )
            
            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_data = user_response.json()
            user_id = user_data["id"]
        
        # Use provided ID or generate new one
        recording_id = id if id else str(uuid.uuid4())
        
        print(f"DEBUG: create_recording called. ID={recording_id}, Title={title}, Duration={duration_seconds}")

        # Upload audio to Storage
        audio_bytes = await audio_file.read()
        print(f"DEBUG: Audio file size: {len(audio_bytes)} bytes")
        
        content_type = audio_file.content_type or "audio/webm"
        audio_url = await upload_to_supabase_storage(user_id, recording_id, audio_bytes, token, content_type)
        print(f"DEBUG: Audio uploaded to: {audio_url}")
        
        # Parse transcripts
        transcripts_list = json.loads(transcripts)
        
        async with await get_supabase_client(token) as supabase_client:
            recording_data = {
                "id": recording_id,
                "user_id": user_id,
                "title": title,
                "audio_url": audio_url,
                "duration_seconds": duration_seconds
            }
            
            print(f"Saving recording {recording_id}: {title}, {duration_seconds}s (Audio Path: {audio_url})")
            
            # Verify duration is valid
            if duration_seconds == 0:
                print(f"⚠️ WARNING: Saving recording with 0 duration! ID: {recording_id}")
            
            # If ID is provided, try to UPDATE first
            if id:
                # Try PATCH
                # Explicitly update title and other fields
                print(f"DEBUG: Attempting PATCH for ID {recording_id}")
                update_response = await supabase_client.patch(
                    f"/rest/v1/recordings?id=eq.{recording_id}",
                    json={
                        "title": title,
                        "duration_seconds": duration_seconds,
                        "audio_url": audio_url,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                )
                if update_response.status_code == 204:
                    print(f"Updated existing recording {recording_id}")
                else:
                    # If update fails (e.g. not found), fall back to upsert
                    print(f"Update failed ({update_response.status_code}), falling back to upsert. Response: {update_response.text}")
                    recording_response = await supabase_client.post(
                        "/rest/v1/recordings",
                        json=recording_data,
                        headers={"Prefer": "resolution=merge-duplicates"}
                    )
                    if recording_response.status_code not in [200, 201, 204]:
                        print(f"DEBUG: Upsert failed: {recording_response.text}")
                        raise HTTPException(status_code=500, detail=f"Database error: {recording_response.text}")
            else:
                # New recording, just insert
                print(f"DEBUG: Inserting new recording {recording_id}")
                recording_response = await supabase_client.post(
                    "/rest/v1/recordings",
                    json=recording_data
                )
                if recording_response.status_code not in [200, 201, 204]:
                    print(f"DEBUG: Insert failed: {recording_response.text}")
                    raise HTTPException(status_code=500, detail=f"Database error: {recording_response.text}")
            
            # Insert transcripts (delete existing first if updating to avoid duplicates?)
            # For simplicity, we'll just insert. If ID conflict, we might need to handle it.
            # But transcripts have their own IDs.
            # If updating, we might want to clear old transcripts first.
            if id:
                await supabase_client.delete(f"/rest/v1/transcripts?recording_id=eq.{recording_id}")

            for trans in transcripts_list:
                transcript_data = {
                    "recording_id": recording_id,
                    "text": trans["text"],
                    "start_time": trans["start_time"],
                    "end_time": trans["end_time"],
                    "confidence": trans.get("confidence"),
                    "is_final": trans.get("is_final", True)
                }
                
                await supabase_client.post(
                    "/rest/v1/transcripts",
                    json=transcript_data
                )
        
        return {"id": recording_id, "audio_url": audio_url}
    
    except Exception as e:
        print(f"Error creating recording: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user/usage")
async def get_user_usage(token: str):
    """Get user's recording usage and remaining limits"""
    try:
        # Verify user
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_KEY
                }
            )
            
            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_data = user_response.json()
            user_id = user_data["id"]

        async with await get_supabase_client(token) as supabase_client:
            # 1. Get Profile for Tier & Cycle Info
            profile_response = await supabase_client.get(
                f"/rest/v1/profiles?id=eq.{user_id}&select=subscription_tier,created_at"
            )
            tier = "free"
            created_at_str = None
            
            if profile_response.status_code == 200 and profile_response.json():
                profile = profile_response.json()[0]
                tier = profile.get("subscription_tier", "free").lower()
                created_at_str = profile.get("created_at")

            # Calculate Billing Cycle
            now = datetime.now(timezone.utc)
            cycle_start = now # Default to now (0 usage) if logic fails
            next_renewal = now + timedelta(days=30)

            if created_at_str:
                # Parse created_at (User Join Date)
                # Example: 2023-01-15T10:00:00+00:00
                signup_date = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                
                # Logic: Find the most recent "monthly anniversary"
                # If signup is Jan 15, and today is Jan 24 -> Start is Jan 15
                # If signup is Jan 15, and today is Feb 20 -> Start is Feb 15
                
                try:
                    # Start with this year/month and signup day
                    cycle_start = now.replace(day=signup_date.day, hour=signup_date.hour, minute=signup_date.minute, second=signup_date.second, microsecond=signup_date.microsecond)
                    
                    # If this date is in the future (e.g. today is Jan 10, signup day is 15th), subtract a month
                    if cycle_start > now:
                       # Go back to previous month
                       # Handle Jan -> Dec wrap carefully or use simple approximate
                       # Easier: just subtract days until we are <= now? No, slightly inaccurate.
                       # Better: relative delta logic or try/except for days (e.g. 31st)
                       pass
                       
                       first_of_month = now.replace(day=1)
                       last_month = first_of_month - timedelta(days=1)
                       
                       # Handle short months (e.g. signup on 31st, now is Feb)
                       try:
                           cycle_start = last_month.replace(day=signup_date.day, hour=signup_date.hour, minute=signup_date.minute)
                       except ValueError:
                           # Fallback to last day of that month
                           cycle_start = last_month.replace(hour=signup_date.hour, minute=signup_date.minute)

                except ValueError:
                     # Handle "Day is out of range for month" (e.g. today is Feb 20, signup was Jan 31)
                     # If trying to set Feb 31st, it fails.
                     # Simplified approach:
                     pass
                     # Robust calculation: get current month start, if day > max_days, use max_days
                     
                     # RE-ATTEMPT SIMPLE LOGIC: 
                     # Calculate months diff
                     diff_years = now.year - signup_date.year
                     diff_months = (diff_years * 12) + now.month - signup_date.month
                     
                     # Candidate start: Signup date + diff_months
                     # Make sure to handle year rollover manually adding months
                     
                     # Actually, the simplest reliable way without dateutil:
                     # Check if we passed the anniversary this month
                     pass_anniversary = False
                     try:
                         this_month_anniv = now.replace(day=signup_date.day, hour=signup_date.hour, minute=signup_date.minute)
                         if now >= this_month_anniv:
                             cycle_start = this_month_anniv
                         else:
                             # Use last month
                             # ... complex ...
                             pass_anniversary = False
                     except ValueError:
                         # e.g. Feb 30th impossible
                         pass_anniversary = True # Effectively "passed" it if it doesn't exist? No.
                         pass

                # --- SIMPLIFIED ROBUST LOGIC ---
                # 1. Start at signup date
                # 2. Add 30-day increments? No, user wants MONTHLY.
                # 3. Use 30 days rolling for MVP? User said "which month" so implies calendar billing.
                
                # Let's trust "last 30 days" as a fallback or do the proper one?
                # "charge should happen every month" implies specific date.
                
                # Let's try this:
                # If created_at is day D.
                # Current period start is Month M, Day D.
                # If Today < Month M, Day D, then it's Month M-1, Day D.
                
                target_day = signup_date.day
                c_year = now.year
                c_month = now.month
                
                # Try to create date for current month
                try:
                    candidate = now.replace(year=c_year, month=c_month, day=target_day, hour=signup_date.hour, minute=signup_date.minute)
                except ValueError:
                    # Day out of range (e.g. 30th in Feb), clamp to last day
                    import calendar
                    last_day_curr = calendar.monthrange(c_year, c_month)[1]
                    candidate = now.replace(year=c_year, month=c_month, day=last_day_curr, hour=signup_date.hour, minute=signup_date.minute)
                
                if candidate <= now:
                    cycle_start = candidate
                else:
                    # We haven't reached this month's billing day yet, go back to prev month
                    if c_month == 1:
            # 1. Determine Billing Cycle Start
            # Priority: billing_start_date (manual override) > created_at (default)
            anchor_date_str = profile.get("billing_start_date") or profile.get("created_at")
            anchor_date = datetime.fromisoformat(anchor_date_str.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            
            # Find the start of the CURRENT monthly cycle relative to the anchor date
            # Logic: Cycle starts on the anchor_day of the current month (or previous month if today < anchor_day)
            
            try:
                # Try setting this month's anchor day
                cycle_start = now.replace(
                    year=now.year, month=now.month, day=anchor_date.day,
                    hour=anchor_date.hour, minute=anchor_date.minute,
                    second=anchor_date.second, microsecond=anchor_date.microsecond
                )
                
                # If this date is in the future, then the cycle started last month
                if cycle_start > now:
                     # Go back one month
                    if now.month == 1:
                        cycle_start = cycle_start.replace(year=now.year - 1, month=12)
                    else:
                        cycle_start = cycle_start.replace(month=now.month - 1)
                        
            except ValueError:
                # Handle short months (e.g. Anchor is 31st, now it's Feb)
                # Fallback: Start of this month (or keep it simple for now)
                cycle_start = now.replace(day=1, hour=0, minute=0, second=0)

            # Next renewal is approx 1 month from cycle start
            # We can approximate next month by adding 32 days and snapping to day 1? No.
            # Simple addition for display:
            if cycle_start.month == 12:
                next_renewal = cycle_start.replace(year=cycle_start.year+1, month=1)
            else:
                try:
                    next_renewal = cycle_start.replace(month=cycle_start.month+1)
                except ValueError:
                    # e.g. Jan 31 -> Feb 28
                    next_renewal = cycle_start + timedelta(days=30)
                 
            # 2. Calculate Usage (Sum duration of recordings SINCE cycle_start)
            cycle_start_iso = cycle_start.isoformat()
            
            rec_response = await supabase_client.get(
                f"/rest/v1/recordings?user_id=eq.{user_id}&created_at=gte.{cycle_start_iso}&select=duration_seconds"
            )
            
            used_seconds = 0
            if rec_response.status_code == 200:
                recordings = rec_response.json()
                used_seconds = sum(r.get("duration_seconds", 0) for r in recordings)
            
            # 3. Define Limits
            # TODO: Move to config/DB
            LIMITS = {
                "free": 30 * 60,       # 30 mins
                "pro": 1200 * 60,      # 20 hours (1200 mins)
                "unlimited": -1        # Infinite
            }
            
            limit = LIMITS.get(tier, LIMITS["free"])
            remaining = -1 if limit == -1 else max(0, limit - used_seconds)
            
            return {
                "tier": tier,
                "used_seconds": used_seconds,
                "limit_seconds": limit,
                "remaining_seconds": remaining,
                "cycle_start": cycle_start_iso,
                "next_renewal": next_renewal.isoformat()
            }

    except Exception as e:
        print(f"Error fetching usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/recordings")
async def get_recordings(token: str):
    """Get all recordings for the authenticated user"""
    try:
        # Verify user and get ID
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_KEY
                }
            )
            
            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_data = user_response.json()
            user_id = user_data["id"]

        async with await get_supabase_client(token) as supabase_client:
            # Explicitly filter by user_id as a safeguard
            response = await supabase_client.get(
                f"/rest/v1/recordings?select=*&user_id=eq.{user_id}&order=created_at.desc"
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            recordings = response.json()
            
            # Generate signed URLs for each recording
            for rec in recordings:
                if rec.get("audio_url"):
                    # Assuming audio_url now stores the path like "user_id/rec_id.webm"
                    # If it's an old public URL, we might need to handle that, but for new ones it's path.
                    path = rec["audio_url"]
                    if path.startswith("http"):
                        # Legacy: It's a full URL, try to extract path or just leave it
                        # If it's a public URL, it might not work if bucket is private now.
                        pass
                    else:
                        # It's a path, sign it
                        signed_url = await create_signed_url(path, token)
                        if signed_url:
                            rec["audio_url"] = signed_url

            return recordings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/recordings/{recording_id}")
async def get_recording(recording_id: str, token: str):
    """Get a specific recording with transcripts"""
    try:
        async with await get_supabase_client(token) as supabase_client:
            # Get recording
            rec_response = await supabase_client.get(
                f"/rest/v1/recordings?id=eq.{recording_id}&select=*"
            )
            
            if rec_response.status_code != 200:
                raise HTTPException(status_code=404, detail="Recording not found")
            
            recordings = rec_response.json()
            if not recordings:
                raise HTTPException(status_code=404, detail="Recording not found")
            
            recording = recordings[0]
            
            # Verify RBAC: Check if user_id matches
            # We get user_id from the token verification in get_supabase_client context? 
            # No, we need to verify it against the user_id we got from auth endpoint.
            
            # We need to get the user_id from the token again to be sure, 
            # OR trust that RLS policies on Supabase handle it.
            # BUT the user asked us to "make sure only the creator... access".
            # RLS is the best place, but let's add an explicit check here too since we have the data.
            
            # Get user ID from token (we should probably do this once at start of request)
            async with httpx.AsyncClient() as client:
                user_res = await client.get(
                    f"{SUPABASE_URL}/auth/v1/user",
                    headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY}
                )
                if user_res.status_code == 200:
                    current_user_id = user_res.json()["id"]
                    if recording["user_id"] != current_user_id:
                        print(f"⛔ Access denied: User {current_user_id} tried to access recording {recording_id} owned by {recording['user_id']}")
                        raise HTTPException(status_code=403, detail="Access denied")

            # Generate signed URL
            if recording.get("audio_url"):
                path = recording["audio_url"]
                if not path.startswith("http"):
                    signed_url = await create_signed_url(path, token)
                    if signed_url:
                        recording["audio_url"] = signed_url

            # Get transcripts
            trans_response = await supabase_client.get(
                f"/rest/v1/transcripts?recording_id=eq.{recording_id}&order=start_time.asc&select=*"
            )
            
            recording["transcripts"] = trans_response.json() if trans_response.status_code == 200 else []
            
            return recording
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/recordings/{recording_id}")
async def delete_recording(recording_id: str, token: str):
    """Delete a recording, its transcripts, live shares, and storage object"""
    try:
        # Verify user
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_KEY
                }
            )

            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")

            user_data = user_response.json()
            user_id = user_data["id"]

        # Fetch recording to confirm ownership and get audio path
        async with await get_supabase_client(token) as supabase_client:
            rec_response = await supabase_client.get(
                f"/rest/v1/recordings?id=eq.{recording_id}&select=*"
            )

            if rec_response.status_code != 200 or not rec_response.json():
                raise HTTPException(status_code=404, detail="Recording not found")

            recording = rec_response.json()[0]
            if recording.get("user_id") != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            audio_path = recording.get("audio_url")

            # Delete transcripts and live shares first
            await supabase_client.delete(f"/rest/v1/transcripts?recording_id=eq.{recording_id}")
            await supabase_client.delete(f"/rest/v1/live_shares?recording_id=eq.{recording_id}")

            # Delete recording row
            delete_response = await supabase_client.delete(f"/rest/v1/recordings?id=eq.{recording_id}")
            if delete_response.status_code not in [200, 204]:
                raise HTTPException(status_code=500, detail=f"Failed to delete recording: {delete_response.text}")

        # Delete storage object after DB delete (best-effort)
        if audio_path and not audio_path.startswith("http"):
            await delete_from_supabase_storage(audio_path, token)

        # Clear in-memory caches
        live_transcripts.pop(recording_id, None)
        live_share_viewers.pop(recording_id, None)
        active_recordings.discard(recording_id)

        return {"status": "deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== LIVE SHARE API ==============

@app.post("/api/shares")
async def create_share(share_data: LiveShareCreate, token: str):
    """Create a live share link"""
    try:
        # Verify user and get ID
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_KEY
                }
            )
            
            if user_response.status_code != 200:
                print(f"Auth failed in create_share: {user_response.text}")
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_data = user_response.json()
            user_id = user_data["id"]

        # Generate unique share token
        share_token = secrets.token_urlsafe(16)
        share_id = str(uuid.uuid4())
        
        expires_at = None
        if share_data.expires_in_hours:
            expires_at = datetime.now() + timedelta(hours=share_data.expires_in_hours)
        
        async with await get_supabase_client(token) as supabase_client:
            share_record = {
                "id": share_id,
                "recording_id": str(share_data.recording_id),
                "share_token": share_token,
                "is_active": True,
                "expires_at": expires_at.isoformat() if expires_at else None
            }
            
            print(f"Creating share for user {user_id} recording {share_data.recording_id}")

            response = await supabase_client.post(
                "/rest/v1/live_shares",
                json=share_record
            )
            
            if response.status_code not in [200, 201]:
                print(f"Supabase insert failed: {response.text}")
                raise HTTPException(status_code=500, detail=f"Failed to create share: {response.text}")
        
        # Initialize empty connections list for this share
        live_share_connections[share_token] = []
        
        return {
            "id": share_id,
            "recording_id": str(share_data.recording_id),
            "share_token": share_token,
            "is_active": True,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "viewer_count": 0,
            "share_url": f"/share/{share_token}"
        }
    
    except Exception as e:
        print(f"Error in create_share: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/shares/{share_token}")
async def get_share(share_token: str):
    """Get shared recording for public viewing"""
    try:
        async with httpx.AsyncClient() as client:
            # Get share info
            share_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/live_shares?share_token=eq.{share_token}&select=*",
                headers={"apikey": SUPABASE_KEY}
            )
            
            if share_response.status_code != 200:
                raise HTTPException(status_code=404, detail="Share not found")
            
            shares = share_response.json()
            if not shares:
                raise HTTPException(status_code=404, detail="Share not found")
            
            share = shares[0]
            
            # Check if expired
            if not share["is_active"]:
                raise HTTPException(status_code=410, detail="Share link has expired")
            
            if share["expires_at"]:
                expires_at = datetime.fromisoformat(share["expires_at"].replace('Z', '+00:00'))
                if datetime.now(expires_at.tzinfo) > expires_at:
                    raise HTTPException(status_code=410, detail="Share link has expired")
            
            recording_id = share["recording_id"]
            
            # Get recording
            rec_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/recordings?id=eq.{recording_id}&select=*",
                headers={"apikey": SUPABASE_KEY}
            )
            
            recording = rec_response.json()[0] if rec_response.status_code == 200 else {}
            
            # Get transcripts
            trans_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/transcripts?recording_id=eq.{recording_id}&order=start_time.asc&select=*",
                headers={"apikey": SUPABASE_KEY}
            )
            
            transcripts = trans_response.json() if trans_response.status_code == 200 else []
            
            return {
                "title": recording.get("title", "Shared Recording"),
                "created_at": recording.get("created_at"),
                "transcripts": transcripts,
                "is_live": recording.get("id") in active_recordings,
                "audio_url": recording.get("audio_url")
            }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_share: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Active live share viewers (keyed by recording_id)
live_share_viewers: Dict[str, List[WebSocket]] = {}
# Active recording sessions (set of recording_ids)
active_recordings: Set[str] = set()
# In-memory storage for live transcripts (keyed by recording_id)
live_transcripts: Dict[str, List[Dict]] = {}

@app.websocket("/ws/watch/{share_token}")
async def watch_endpoint(websocket: WebSocket, share_token: str):
    await websocket.accept()
    
    try:
        # Verify share token and get recording_id
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/live_shares?share_token=eq.{share_token}&select=recording_id,is_active,expires_at",
                headers={"apikey": SUPABASE_KEY}
            )
            
            if response.status_code != 200 or not response.json():
                await websocket.close(code=4004, reason="Share not found")
                return
                
            share_data = response.json()[0]
            
            if not share_data["is_active"]:
                await websocket.close(code=4003, reason="Share is not active")
                return
                
            if share_data["expires_at"] and datetime.fromisoformat(share_data["expires_at"].replace('Z', '+00:00')) < datetime.now(timezone.utc):
                await websocket.close(code=4003, reason="Share expired")
                return
                
            recording_id = share_data["recording_id"]
            
        # Add to viewers list
        if recording_id not in live_share_viewers:
            live_share_viewers[recording_id] = []
        live_share_viewers[recording_id].append(websocket)
        
        print(f"👀 Viewer connected to recording {recording_id}")
        
        # Send existing transcripts to new viewer
        if recording_id in live_transcripts:
            print(f"📜 Sending {len(live_transcripts[recording_id])} existing transcripts to new viewer")
            for transcript_msg in live_transcripts[recording_id]:
                await websocket.send_text(json.dumps(transcript_msg))
        
        try:
            while True:
                # Keep connection open and handle ping/pong
                await websocket.receive_text()
        except:
            pass
        finally:
            if recording_id in live_share_viewers:
                live_share_viewers[recording_id].remove(websocket)
                if not live_share_viewers[recording_id]:
                    del live_share_viewers[recording_id]
            print(f"👋 Viewer disconnected from recording {recording_id}")

    except Exception as e:
        print(f"Watch error: {e}")
        await websocket.close()


@app.websocket("/ws/transcribe")
async def transcribe_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = str(uuid.uuid4())

    current_recording_title = "Live Recording"
    
    def get_timestamp():
        return datetime.now().strftime('%H:%M:%S.%f')[:-3]
    
    print(f"[{get_timestamp()}] 🔌 Client connected [{client_id}]")
    
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        print(f"[{get_timestamp()}] ❌ Error: DEEPGRAM_API_KEY not found")
        await websocket.close(code=1008, reason="Missing API Key")
        return

    # Verify authentication
    try:
        token = websocket.query_params.get("token")
        if not token:
            print(f"[{client_id}] ❌ Missing authentication token")
            await websocket.close(code=4001)
            return

        # Verify token with Supabase
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{os.environ.get('SUPABASE_URL')}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": os.environ.get("SUPABASE_ANON_KEY")
                }
            )
            
            if response.status_code != 200:
                print(f"[{client_id}] ❌ Invalid token: {response.text}")
                await websocket.close(code=4001)
                return
                
            user = response.json()
            user_id = user.get("id")
            email = user.get("email")
            print(f"[{client_id}] 👤 Authenticated as: {email} ({user_id})")

            # Check subscription tier for time limits
            tier_limits = {
                "free": 600,  # 10 minutes per session
                "pro": 1200 * 60,  # 1,200 minutes per session
                "unlimited": None  # No cap
            }
            session_limit_seconds = tier_limits["free"]
            
            profile_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=subscription_tier,usage_seconds",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {token}"
                }
            )
            if profile_res.status_code == 200 and profile_res.json():
                profile = profile_res.json()[0]
                tier = profile.get("subscription_tier", "free")
                session_limit_seconds = tier_limits.get(tier, tier_limits["free"])
            else:
                tier = "free"
            
            print(f"[{client_id}] Using tier '{tier}' with session cap: {session_limit_seconds if session_limit_seconds is not None else 'unlimited'}s")
            
    except Exception as e:
        print(f"[{client_id}] ❌ Auth error: {e}")
        await websocket.close(code=4001)
        return

    # Initialize performance metrics
    metrics = PerformanceMetrics()
    session_start_time: Optional[float] = None
    limit_task: Optional[asyncio.Task] = None
    total_recorded_seconds = 0.0
    
    # Initialize audio buffer for this client
    audio_buffer = AudioBuffer()
    active_buffers[client_id] = audio_buffer
    
    # Deepgram WebSocket URL with INTERIM RESULTS enabled for real-time transcription
    dg_url = "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&filler_words=false&punctuate=true&encoding=linear16&sample_rate=16000&channels=1&endpointing=200"
    
    extra_headers = {
        "Authorization": f"Token {api_key}"
    }

    try:
        # Connect to Deepgram
        async with websockets.connect(dg_url, additional_headers=extra_headers) as dg_socket:
            print(f"[{get_timestamp()}] ✅ Connected to Deepgram")

            # Keepalive task to prevent timeout
            keepalive_count = 0
            async def send_keepalive():
                nonlocal keepalive_count
                try:
                    while True:
                        await asyncio.sleep(5)
                        keepalive_count += 1
                        await dg_socket.send(json.dumps({"type": "KeepAlive"}))
                        print(f"[{get_timestamp()}] 💓 Keepalive #{keepalive_count} sent")
                except Exception as e:
                    print(f"[{get_timestamp()}] ⚠️ Keepalive error: {e}")

            # Task to receive from Deepgram and send to Client
            async def receive_from_deepgram():
                try:
                    async for msg in dg_socket:
                        receive_time = get_timestamp()
                        
                        try:
                            data = json.loads(msg)
                            
                            # Log all message types from Deepgram
                            msg_type = data.get("type", "unknown")
                            
                            if msg_type == "Results":
                                # Standard transcription result
                                if "channel" in data:
                                    alternatives = data["channel"]["alternatives"]
                                    if alternatives:
                                        transcript = alternatives[0]["transcript"]
                                        confidence = alternatives[0].get("confidence", 0)
                                        is_final = data.get("is_final", False)
                                        speech_final = data.get("speech_final", False)
                                        
                                        if transcript and len(transcript.strip()) > 0:
                                            metrics.log_transcript_received()
                                            
                                            # Send to client with type indicator
                                            message = json.dumps({
                                                "transcript": transcript,
                                                "is_final": is_final or speech_final,
                                                "confidence": confidence
                                            })
                                            await websocket.send_text(message)

                                            # Broadcast + Store logic
                                            if current_recording_id:
                                                 # Add timestamp for sync
                                                broadcast_msg = {
                                                    "transcript": transcript,
                                                    "is_final": is_final or speech_final,
                                                    "confidence": confidence,
                                                    "timestamp": datetime.now().timestamp(),
                                                    # For saving later:
                                                    "start": alternatives[0].get("words", [{}])[0].get("start", 0),
                                                    "end": alternatives[0].get("words", [{}])[-1].get("end", 0)
                                                }
                                                
                                                # Store in memory for late joiners AND final save
                                                if current_recording_id not in live_transcripts:
                                                    live_transcripts[current_recording_id] = []
                                                live_transcripts[current_recording_id].append(broadcast_msg)
                                                
                                                # Broadcast to live viewers (if any)
                                                if current_recording_id in live_share_viewers:
                                                    viewers = live_share_viewers[current_recording_id]
                                                    if viewers:
                                                        json_msg = json.dumps(broadcast_msg)
                                                        for viewer in viewers:
                                                            try:
                                                                await viewer.send_text(json_msg)
                                                            except:
                                                                pass 

                            elif msg_type == "UtteranceEnd":
                                print(f"[{receive_time}] 🔚 Utterance end detected")
                            
                        except json.JSONDecodeError as e:
                            print(f"[{receive_time}] ⚠️ Failed to parse Deepgram message: {e}")
                            
                except Exception as e:
                    print(f"[{get_timestamp()}] ❌ Error receiving from Deepgram: {e}")

            # Statistics reporting task (DEBUG mode only)
            async def report_statistics():
                if not DEBUG:
                    return
                try:
                    while True:
                        await asyncio.sleep(10)  # Report every 10 seconds
                        stats = metrics.get_stats_summary()
                        print(f"\n[{get_timestamp()}] 📊 PERFORMANCE STATS: Runtime {stats['runtime_seconds']}s")
                except:
                    pass

            async def enforce_time_limit():
                """Hard-stop the session when the per-tier limit is reached."""
                nonlocal session_start_time, total_recorded_seconds
                if session_limit_seconds is None:
                    return
                try:
                    while True:
                        await asyncio.sleep(1)
                        if session_start_time is None:
                            continue
                        
                        elapsed = time.monotonic() - session_start_time
                        if elapsed >= session_limit_seconds:
                            print(f"[{client_id}] ⛔ Session time limit reached")
                            if session_start_time is not None:
                                total_recorded_seconds += session_limit_seconds
                                session_start_time = None
                            try:
                                await websocket.send_text(json.dumps({
                                    "type": "limit_reached",
                                    "tier": tier,
                                    "limit_seconds": session_limit_seconds
                                }))
                                await dg_socket.close()
                                await websocket.close(code=4002, reason="time limit reached")
                            except: pass
                            return
                except asyncio.CancelledError:
                    return

            def start_limit_timer(force_reset: bool = False):
                """Start/reset the session timer once the user begins a recording."""
                nonlocal session_start_time, limit_task
                if session_limit_seconds is None:
                    return
                if force_reset or session_start_time is None:
                    if force_reset and session_start_time is not None:
                        total_recorded_seconds += time.monotonic() - session_start_time
                    session_start_time = time.monotonic()
                    if limit_task:
                        limit_task.cancel()
                        limit_task = None
                if not limit_task or limit_task.done():
                    limit_task = asyncio.create_task(enforce_time_limit())

            # SERVER-SIDE SAVE FUNCTION
            async def save_session_data():
                try:
                    if not current_recording_id or not user_id:
                        return

                    # 1. Finalize Duration
                    session_duration = int(total_recorded_seconds)
                    if session_start_time:
                         session_duration += max(0, int(time.monotonic() - session_start_time))
                    
                    if session_duration <= 0 and audio_buffer.chunks:
                        # Fallback to pure audio duration if timer failed
                        session_duration = int(audio_buffer.get_duration_seconds())

                    print(f"💾 SAVING SESSION: {current_recording_id} ({session_duration}s)")

                    # 2. Upload Audio
                    wav_bytes = audio_buffer.get_wav_bytes()
                    audio_path = None
                    if wav_bytes:
                        try:
                            print(f"   Uploading {len(wav_bytes)} bytes...")
                            audio_path = await upload_to_supabase_storage(
                                user_id, current_recording_id, wav_bytes, token, "audio/wav"
                            )
                            print(f"   Audio uploaded: {audio_path}")
                        except Exception as e:
                            print(f"   ❌ Upload failed: {e}")

                    async with await get_supabase_client(token) as supabase_client:
                        # 3. Update/Insert Recording Record
                        recording_record = {
                            "id": current_recording_id,
                            "user_id": user_id,
                            "title": current_recording_title, # title from configure msg
                            "duration_seconds": session_duration,
                            "audio_url": audio_path,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        # Upsert recording
                        rec_res = await supabase_client.post(
                            "/rest/v1/recordings",
                            json=recording_record,
                            headers={"Prefer": "resolution=merge-duplicates"}
                        )
                        if rec_res.status_code not in [200, 201, 204]:
                             print(f"   ❌ Recording DB save failed: {rec_res.text}")
                        else:
                             print("   ✅ Recording metadata saved.")

                        # 4. Save Transcripts (Bulk)
                        if current_recording_id in live_transcripts:
                            transcripts_to_save = []
                            for t in live_transcripts[current_recording_id]:
                                if t.get("is_final"):
                                    transcripts_to_save.append({
                                        "recording_id": current_recording_id,
                                        "text": t["transcript"],
                                        "start_time": t.get("start", 0),
                                        "end_time": t.get("end", 0),
                                        "confidence": t.get("confidence"),
                                        "is_final": True
                                    })
                            
                            if transcripts_to_save:
                                # Delete old just in case (optional, safe for new recs)
                                await supabase_client.delete(f"/rest/v1/transcripts?recording_id=eq.{current_recording_id}")
                                
                                # Insert new
                                trans_res = await supabase_client.post(
                                    "/rest/v1/transcripts",
                                    json=transcripts_to_save
                                )
                                if trans_res.status_code in [200, 201, 204]:
                                    print(f"   ✅ Saved {len(transcripts_to_save)} transcript segments.")
                                else:
                                    print(f"   ❌ Transcript save failed: {trans_res.text}")

                        # 5. Update User Usage
                        if session_duration > 0:
                             # Fetch current usage again
                            p_res = await supabase_client.get(f"/rest/v1/profiles?id=eq.{user_id}&select=usage_seconds")
                            if p_res.status_code == 200 and p_res.json():
                                current_usage = p_res.json()[0].get("usage_seconds", 0) or 0
                                new_usage = current_usage + session_duration
                                
                                await supabase_client.patch(
                                    f"/rest/v1/profiles?id=eq.{user_id}",
                                    json={"usage_seconds": new_usage}
                                )
                                print(f"   📈 User usage updated: +{session_duration}s")

                except Exception as e:
                    print(f"❌ CRITICAL SAVE ERROR: {e}")
                    import traceback
                    traceback.print_exc()


            # Start tasks
            receive_task = asyncio.create_task(receive_from_deepgram())
            keepalive_task = asyncio.create_task(send_keepalive())
            stats_task = asyncio.create_task(report_statistics())

            # Main loop: Receive audio/config from Client
            try:
                while True:
                    # Receive message (text or bytes)
                    message = await websocket.receive()
                    
                    if "text" in message:
                        # Handle configuration messages
                        try:
                            data = json.loads(message["text"])
                            if data.get("type") == "configure" and "recording_id" in data:
                                current_recording_id = data["recording_id"]
                                current_recording_title = data.get("title", current_recording_title)
                                active_recordings.add(current_recording_id)
                                start_limit_timer(True)
                                print(f"[{client_id}] 🎥 Configured: {current_recording_id} '{current_recording_title}'")
                            elif data.get("type") == "stop_recording":
                                print(f"[{client_id}] 🛑 Stop received. Saving...")
                                # Explicit save trigger
                                await save_session_data()
                            else:
                                pass
                        except IndexError: pass
                        except Exception: pass
                            
                    elif "bytes" in message:
                        data = message["bytes"]
                        start_limit_timer()
                        await dg_socket.send(data)
                        audio_buffer.add_chunk(data)
                        metrics.log_chunk_sent(len(data))
                    
            except Exception as e:
                print(f"[{get_timestamp()}] ⚠️ Client loop error: {e}")
            finally:
                # Cleanup
                if receive_task: receive_task.cancel()
                if keepalive_task: keepalive_task.cancel()
                if stats_task: stats_task.cancel()
                if limit_task: limit_task.cancel()
                
                # Verify we saved, if not save now (e.g. connection drop)
                # Ideally we check a flag, but for now calling it again is okay-ish (idempotent-ish upsert)
                # or we just rely on explicit stop. 
                # Better: call save_session_data here if audio_buffer has data and we haven't saved?
                # For simplicity in this logic block, let's just assume explicit stop is main path.
                # BUT if connection drops, we WANT to save.
                if audio_buffer.chunks: 
                     print(f"[{client_id}] Connection closed with unsaved data. Auto-saving...")
                     await save_session_data()

                print(f"\n[{get_timestamp()}] 🔌 Closing {client_id}")
                if current_recording_id:
                    active_recordings.discard(current_recording_id)
                    # Clean up memory buffers 
                    active_buffers.pop(client_id, None)
                    # Remove live transcripts after a delay or immediately?
                    # Keep for a bit for any lagging viewers? No, simple cleanup.
                    live_transcripts.pop(current_recording_id, None)

    except Exception as e:
        print(f"[{get_timestamp()}] ❌ Deepgram connection failed: {e}")
        await websocket.close()
