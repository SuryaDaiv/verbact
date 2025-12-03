from fastapi import APIRouter, HTTPException, Request, Header
import stripe
import os
from supabase import create_client, Client
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter()

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

# Initialize Supabase
# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Client for public interactions (if needed)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Admin client for webhooks (bypasses RLS)
if SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    print("⚠️ SUPABASE_SERVICE_ROLE_KEY not found. Webhook updates may fail due to RLS.")
    supabase_admin = supabase

class CheckoutSessionRequest(BaseModel):
    price_id: str
    user_id: str
    email: str
    return_url: str

@router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutSessionRequest):
    try:
        # Define prices (You can also use Price IDs from Stripe Dashboard)
        # For simplicity, we map "price_id" from frontend to ad-hoc prices or real IDs
        
        # Map frontend "tier" names to amounts (in cents)
        amounts = {
            "pro": 700, # $7.00
            "unlimited": 1500 # $15.00
        }
        
        if request.price_id not in amounts:
             raise HTTPException(status_code=400, detail="Invalid price ID")

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'unit_amount': amounts[request.price_id],
                        'product_data': {
                            'name': f'Verbact {request.price_id.capitalize()} Subscription',
                        },
                        'recurring': {
                            'interval': 'month',
                        },
                    },
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=request.return_url + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=request.return_url,
            client_reference_id=request.user_id,
            customer_email=request.email,
            metadata={
                'user_id': request.user_id,
                'tier': request.price_id
            }
        )
        return {"sessionId": checkout_session.id, "url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()
    sig_header = stripe_signature
    event = None

    try:
        # If we have a webhook secret, verify signature
        if endpoint_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        else:
            # For local testing without CLI, just parse
            event = stripe.Event.construct_from(
                json.loads(payload), stripe.api_key
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id')
        # metadata = session.get('metadata', {})
        # tier = metadata.get('tier') 
        # Sometimes metadata isn't in the session object directly in some API versions, but usually it is.
        # Better to rely on what we sent.
        
        # We need to determine the tier. 
        # In a real app, we'd look up the Price ID. 
        # Here, let's assume we passed it in metadata.
        tier = session['metadata'].get('tier')

        if user_id and tier:
            # Update user profile
            # Note: This requires Service Role Key to bypass RLS if the user isn't the one making the request (which is true for webhooks)
            # OR we can use a Postgres Function `security definer` and call it via RPC.
            # Let's try updating directly. If it fails, we'll need to add a function.
            
            try:
                supabase_admin.table("profiles").update({
                    "subscription_tier": tier,
                    "stripe_customer_id": session['customer'],
                    "subscription_status": "active"
                }).eq("id", user_id).execute()
                print(f"Updated user {user_id} to tier {tier}")
            except Exception as e:
                print(f"Error updating Supabase: {e}")
                # If RLS fails, we might need a stored procedure
                
    return {"status": "success"}
