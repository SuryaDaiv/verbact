import asyncio
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = "http://localhost:8000"
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Test credentials (you might need to update these or use a known test user)
TEST_EMAIL = "integration.test.user@verbact.com"
TEST_PASSWORD = "password123"

async def get_test_token():
    async with httpx.AsyncClient() as client:
        # Try to sign in
        response = await client.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_KEY},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            return response.json()["access_token"]
        
        # If failed, try to sign up (idempotent for test)
        print("Sign in failed, trying sign up...")
        response = await client.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers={"apikey": SUPABASE_KEY},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            return response.json()["access_token"]
            
        print(f"Auth failed: {response.text}")
        return None

async def test_rbac_playback():
    print("Starting RBAC & Playback Integration Test")
    
    token = await get_test_token()
    if not token:
        print("Failed to get auth token")
        return

    print("Authenticated")

    async with httpx.AsyncClient() as client:
        # 1. Create a dummy recording
        print("\nCreating test recording...")
        
        # Create a tiny dummy WAV file
        dummy_wav = b'RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'
        
        files = {
            "audio_file": ("test.wav", dummy_wav, "audio/wav")
        }
        data = {
            "title": "Integration Test Recording",
            "duration_seconds": 5,
            "transcripts": json.dumps([{"text": "Test", "start_time": 0, "end_time": 1}]),
            "token": token
        }
        
        response = await client.post(f"{BACKEND_URL}/api/recordings", data=data, files=files)
        
        if response.status_code != 200:
            print(f"Failed to create recording: {response.text}")
            return
            
        result = response.json()
        recording_id = result["id"]
        audio_url = result.get("audio_url")
        
        print(f"Recording created: {recording_id}")
        print(f"   Audio URL: {audio_url}")
        
        if "token=" not in audio_url:
            print("Audio URL does not look like a signed URL (missing token param)")
        else:
            print("Audio URL appears to be signed")

        # 2. Fetch recording as owner
        print("\nFetching recording as owner...")
        response = await client.get(f"{BACKEND_URL}/api/recordings/{recording_id}?token={token}")
        
        if response.status_code != 200:
            print(f"Failed to fetch recording: {response.text}")
        else:
            rec_data = response.json()
            print(f"Fetch success. Title: {rec_data['title']}")
            print(f"   Fetched Audio URL: {rec_data['audio_url']}")
            
            if "token=" in rec_data["audio_url"]:
                 print("Fetched Audio URL is signed")
            else:
                 print("Fetched Audio URL is NOT signed")

        # 3. Verify Signed URL accessibility
        print("\nVerifying Signed URL accessibility...")
        # We need to fetch the signed URL. Note: It might be a Supabase Storage URL.
        # Since we are running backend locally but Supabase is remote, we can try to HEAD it.
        
        try:
            url_res = await client.get(audio_url)
            if url_res.status_code == 200:
                print("Signed URL is accessible (200 OK)")
            else:
                print(f"Signed URL failed: {url_res.status_code}")
        except Exception as e:
            print(f"Error checking URL: {e}")

if __name__ == "__main__":
    asyncio.run(test_rbac_playback())
