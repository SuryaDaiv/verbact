import os
import json
import types
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers import payments


def test_resolve_tier_from_metadata(monkeypatch):
    session = {"metadata": {"tier": "pro"}}
    assert payments.resolve_tier_from_session(session) == "pro"


def test_resolve_tier_from_price_map(monkeypatch):
    monkeypatch.setenv("STRIPE_PRICE_PRO", "price_pro")
    monkeypatch.setenv("STRIPE_PRICE_UNLIMITED", "price_unl")
    session = {
        "metadata": {},
        "line_items": [{"price": {"id": "price_unl"}}]
    }
    assert payments.resolve_tier_from_session(session) == "unlimited"


def test_webhook_updates_supabase(monkeypatch):
    # Fake Stripe webhook verification
    fake_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": "user123",
                "metadata": {"tier": "pro"},
                "customer": "cus_123"
            }
        }
    }

    def fake_construct_event(payload, sig, secret):
        return fake_event

    monkeypatch.setattr(payments.stripe.Webhook, "construct_event", fake_construct_event)
    monkeypatch.setenv("SUPABASE_URL", "http://example.com")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service_key")

    # Fake Supabase client
    class FakeTable:
        def __init__(self):
            self.updated = None

        def update(self, payload):
            self.payload = payload
            return self

        def eq(self, key, value):
            self.filter = (key, value)
            return self

        def execute(self):
            self.updated = {"payload": getattr(self, "payload", None), "filter": getattr(self, "filter", None)}
            return {"data": []}

    class FakeSupabase:
        def __init__(self):
            self.table_obj = FakeTable()

        def table(self, name):
            return self.table_obj

    fake_supabase = FakeSupabase()
    monkeypatch.setattr(payments, "get_supabase_client", lambda: fake_supabase)

    app = FastAPI()
    app.include_router(payments.router, prefix="/api/payments")
    client = TestClient(app)

    resp = client.post(
        "/api/payments/webhook",
        data=json.dumps(fake_event),
        headers={"stripe-signature": "dummy"}
    )

    assert resp.status_code == 200
    assert fake_supabase.table_obj.updated["filter"] == ("id", "user123")
    assert fake_supabase.table_obj.updated["payload"]["subscription_tier"] == "pro"
