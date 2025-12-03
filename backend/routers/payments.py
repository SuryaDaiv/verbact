import os
import json
from typing import Optional, Dict, Any

import stripe
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from supabase import create_client, Client


router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


def get_supabase_client() -> Client:
    """Return a Supabase client using service role if available (bypasses RLS for webhooks)."""
    key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
    if not SUPABASE_URL or not key:
        raise RuntimeError("Supabase URL or key is not configured")
    return create_client(SUPABASE_URL, key)


def _price_id_map() -> Dict[str, str]:
    """Map Stripe price IDs from env to internal tiers."""
    mapping: Dict[str, str] = {}
    pro_price = os.getenv("STRIPE_PRICE_PRO")
    unlimited_price = os.getenv("STRIPE_PRICE_UNLIMITED")
    if pro_price:
        mapping[pro_price] = "pro"
    if unlimited_price:
        mapping[unlimited_price] = "unlimited"
    return mapping


def resolve_tier_from_session(session: Dict[str, Any]) -> Optional[str]:
    """Attempt to resolve the tier from session metadata or price IDs."""
    metadata = session.get("metadata") or {}
    if metadata.get("tier"):
        return metadata.get("tier")

    mapping = _price_id_map()

    # If line_items are expanded, try to map price IDs
    line_items = session.get("line_items") or []
    for item in line_items:
        price = (item.get("price") or {}).get("id")
        if price and price in mapping:
            return mapping[price]

    return None


class CheckoutSessionRequest(BaseModel):
    price_id: str  # expected tier key such as "pro" or "unlimited"
    user_id: str
    email: str
    return_url: str


@router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutSessionRequest):
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    price_map = _price_id_map()

    # Accept direct price IDs or simple tier keys ('pro', 'unlimited')
    price_id = price_map.get(request.price_id, request.price_id)

    try:
        checkout_session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=request.return_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=request.return_url,
            client_reference_id=request.user_id,
            customer_email=request.email,
            metadata={
                "user_id": request.user_id,
                "tier": request.price_id,  # store original tier key
            },
        )
        return {"sessionId": checkout_session.id, "url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()

    try:
        if endpoint_secret:
            event = stripe.Webhook.construct_event(payload, stripe_signature, endpoint_secret)
        else:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload or signature")

    if event["type"] != "checkout.session.completed":
        return {"status": "ignored"}

    session = event["data"]["object"]
    user_id = session.get("client_reference_id")
    tier = resolve_tier_from_session(session)

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id on session")
    if not tier:
        raise HTTPException(status_code=400, detail="Unable to determine tier")

    try:
        supabase = get_supabase_client()
        supabase.table("profiles").update(
            {
                "subscription_tier": tier,
                "stripe_customer_id": session.get("customer"),
                "subscription_status": "active",
            }
        ).eq("id", user_id).execute()
    except Exception as e:
        # Log but return 200 so Stripe doesn't retry indefinitely
        print(f"[payments] Failed to update subscription for {user_id}: {e}")
        return {"status": "supabase_update_failed"}

    return {"status": "success"}
