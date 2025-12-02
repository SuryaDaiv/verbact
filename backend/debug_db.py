import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") # Use anon key as service role key is missing

if not SUPABASE_KEY:
    print("WARNING: SUPABASE_ANON_KEY not found!")
    # Try to read directly from .env if os.getenv fails
    try:
        with open(os.path.join(os.path.dirname(__file__), ".env"), "r") as f:
            for line in f:
                if line.startswith("SUPABASE_ANON_KEY="):
                    SUPABASE_KEY = line.strip().split("=", 1)[1]
                    print("Found SUPABASE_ANON_KEY in .env file manually")
    except Exception as e:
        print(f"Failed to read .env file manually: {e}")

async def debug_db():
    print("Debugging DB State...")
    
    async with httpx.AsyncClient() as client:
        # Fetch last 5 recordings
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/recordings?select=*&order=created_at.desc&limit=5",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}"
            }
        )
        
        if response.status_code != 200:
            print(f"Failed to fetch recordings: {response.text}")
            return

        recordings = response.json()
        print(f"found {len(recordings)} recordings")
        
        for rec in recordings:
            print("-" * 40)
            print(f"ID: {rec['id']}")
            print(f"Title: {rec['title']}")
            print(f"Duration: {rec['duration_seconds']} (Type: {type(rec['duration_seconds'])})")
            print(f"Audio URL: {rec['audio_url']}")
            print(f"User ID: {rec['user_id']}")
            print(f"Created At: {rec['created_at']}")
            
            # Check if audio file exists (HEAD request)
            # If audio_url is a path, construct full URL for checking (assuming public for check, or sign it)
            # But wait, we changed it to be a path. So we need to sign it to check existence?
            # Or we can just check if it looks right.
            
            if "http" in rec['audio_url']:
                 print("Audio URL is a full URL (Legacy?)")
            else:
                 print("Audio URL is a path (New format)")

if __name__ == "__main__":
    asyncio.run(debug_db())
