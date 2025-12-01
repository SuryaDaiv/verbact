import asyncio
import websockets
import os

async def test_streaming():
    uri = "ws://localhost:8000/ws/transcribe"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            # Simulate sending 3 chunks of silence/noise
            # In a real test we'd send actual audio, but here we just want to see if the server accepts and responds
            # or if it waits until the end.
            
            for i in range(5):
                # Create a dummy audio chunk (1 second of silence)
                # WebM header + some data would be ideal, but let's see if it accepts bytes
                # For this to work with Groq, it needs valid audio. 
                # We'll just send a small message to check connectivity first, 
                # but the backend expects audio bytes.
                
                print(f"Sending chunk {i+1}...")
                # We can't easily generate valid WebM bytes here without a library, 
                # so this test might fail on the *transcription* part, 
                # but we want to see if the WebSocket *receives* and *tries* to process it immediately.
                
                # Sending random bytes might cause Groq to error, but we should see that error IMMEDIATELY
                # not after we close the connection.
                await websocket.send(os.urandom(10000)) 
                
                try:
                    # Wait briefly for a response
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    print(f"Received: {response}")
                except asyncio.TimeoutError:
                    print("No response within 2s (Server might be buffering or processing)")
                
                await asyncio.sleep(1)
            
            print("Closing connection...")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_streaming())
