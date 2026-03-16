"""
Paddle Webhook Handler (FastAPI)

Paddle 샌드박스 웹훅 수신 엔드포인트
dev tunnel: https://htnsnhjd-8000.jpe1.devtunnels.ms/paddle-webhook
"""

import hashlib
import hmac
import json
import logging
import os

from fastapi import APIRouter, Request, Response

logger = logging.getLogger(__name__)

router = APIRouter()


def verify_paddle_signature(body: str, signature_header: str) -> bool:
    """
    Paddle Billing v2 서명 검증
    헤더 형식: Paddle-Signature: ts=<timestamp>;h1=<hmac_hex>
    검증 메시지: <ts>:<body>
    """
    webhook_secret = os.environ.get("PADDLE_WEBHOOK_SECRET", "")
    if not webhook_secret:
        logger.warning("PADDLE_WEBHOOK_SECRET not set - skipping signature verification")
        return True  # 샌드박스 테스트 시 검증 스킵

    try:
        parts = {}
        for part in signature_header.split(";"):
            if "=" in part:
                k, v = part.split("=", 1)
                parts[k.strip()] = v.strip()

        ts = parts.get("ts", "")
        h1 = parts.get("h1", "")

        if not ts or not h1:
            logger.error("Invalid signature header format: %s", signature_header)
            return False

        # Paddle Billing v2: HMAC-SHA256("{ts}:{body}")
        msg = f"{ts}:{body}"
        expected = hmac.new(
            webhook_secret.encode("utf-8"),
            msg.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, h1)

    except Exception as e:
        logger.error("Signature verification error: %s", e)
        return False


def get_supabase_client():
    """런타임에 Supabase 클라이언트 생성 (supabase-py)"""
    try:
        from supabase import create_client

        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SERVICE_KEY", "")
        )
        if not url or not key:
            logger.error("Supabase env vars missing")
            return None
        return create_client(url, key)
    except ImportError:
        logger.warning("supabase-py not installed - DB updates skipped")
        return None


async def handle_subscription_created(event: dict):
    data = event.get("data", event)
    # custom_data 가 null 로 올 수 있으므로 `or {}` 로 None 방어
    custom_data = data.get("custom_data") or {}
    user_id = data.get("user_id") or custom_data.get("user_id")
    subscription_id = data.get("subscription_id") or data.get("id")
    items = data.get("items") or [{}]
    plan_id = data.get("subscription_plan_id") or (items[0].get("price") or {}).get("id")
    status = data.get("status", "active")
    next_bill_date = data.get("next_bill_date") or data.get("next_billed_at")

    logger.info("[OK] Subscription created: %s for user %s", subscription_id, user_id)

    supabase = get_supabase_client()
    if supabase and user_id:
        supabase.table("subscriptions").upsert({
            "user_id": user_id,
            "paddle_subscription_id": subscription_id,
            "paddle_plan_id": plan_id,
            "status": status,
            "next_billing_date": next_bill_date,
        }).execute()

        supabase.table("users").update({
            "plan": "pro",
            "subscription_status": "active",
        }).eq("id", user_id).execute()


async def handle_subscription_updated(event: dict):
    data = event.get("data", event)
    subscription_id = data.get("subscription_id") or data.get("id")
    status = data.get("status", "active")
    next_bill_date = data.get("next_bill_date") or data.get("next_billed_at")

    logger.info("[UPDATE] Subscription updated: %s -> %s", subscription_id, status)

    supabase = get_supabase_client()
    if supabase and subscription_id:
        supabase.table("subscriptions").update({
            "status": status,
            "next_billing_date": next_bill_date,
        }).eq("paddle_subscription_id", subscription_id).execute()


async def handle_subscription_canceled(event: dict):
    data = event.get("data", event)
    custom_data = data.get("custom_data") or {}
    user_id = data.get("user_id") or custom_data.get("user_id")
    subscription_id = data.get("subscription_id") or data.get("id")

    logger.info("[CANCEL] Subscription canceled: %s", subscription_id)

    supabase = get_supabase_client()
    if supabase:
        if subscription_id:
            supabase.table("subscriptions").update({
                "status": "canceled",
            }).eq("paddle_subscription_id", subscription_id).execute()
        if user_id:
            supabase.table("users").update({
                "plan": "free",
                "subscription_status": "canceled",
            }).eq("id", user_id).execute()


async def handle_payment_succeeded(event: dict):
    data = event.get("data", event)
    subscription_id = data.get("subscription_id") or data.get("id")
    amount = data.get("amount") or data.get("details", {}).get("totals", {}).get("total")
    currency = data.get("currency") or data.get("currency_code", "USD")

    logger.info("[PAID] Payment succeeded: %s %s for %s", amount, currency, subscription_id)

    supabase = get_supabase_client()
    if supabase and subscription_id:
        supabase.table("payments").insert({
            "paddle_subscription_id": subscription_id,
            "amount": amount,
            "currency": currency,
            "status": "succeeded",
        }).execute()


async def handle_payment_failed(event: dict):
    data = event.get("data", event)
    subscription_id = data.get("subscription_id") or data.get("id")

    logger.info("[FAIL] Payment failed for %s", subscription_id)

    supabase = get_supabase_client()
    if supabase and subscription_id:
        supabase.table("subscriptions").update({
            "status": "past_due",
        }).eq("paddle_subscription_id", subscription_id).execute()


@router.post("/paddle-webhook")
async def paddle_webhook(request: Request):
    """
    Paddle 샌드박스 웹훅 수신
    Paddle 대시보드 설정: https://htnsnhjd-8000.jpe1.devtunnels.ms/paddle-webhook
    """
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")

    # 서명 검증
    signature_header = request.headers.get("Paddle-Signature", "")
    if not verify_paddle_signature(body_str, signature_header):
        logger.error("[ERROR] Invalid Paddle webhook signature")
        return Response(content='{"error":"Invalid signature"}', status_code=401, media_type="application/json")

    try:
        event = json.loads(body_str)
    except json.JSONDecodeError as e:
        logger.error("❌ JSON parse error: %s", e)
        return Response(content='{"error":"Invalid JSON"}', status_code=400, media_type="application/json")

    event_type = event.get("event_type") or event.get("alert_name", "")
    logger.info("[WEBHOOK] Paddle webhook received: %s", event_type)

    handlers = {
        "subscription.created": handle_subscription_created,
        "subscription_created": handle_subscription_created,
        "subscription.updated": handle_subscription_updated,
        "subscription_updated": handle_subscription_updated,
        "subscription.canceled": handle_subscription_canceled,
        "subscription_cancelled": handle_subscription_canceled,
        "payment.succeeded": handle_payment_succeeded,
        "subscription_payment_succeeded": handle_payment_succeeded,
        "payment.failed": handle_payment_failed,
        "subscription_payment_failed": handle_payment_failed,
    }

    handler = handlers.get(event_type)
    if handler:
        await handler(event)
    else:
        logger.info("[INFO] Unhandled event type: %s", event_type)

    return {"received": True}
