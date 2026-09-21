import json
import logging
import uuid
import stripe

from app.core.config import settings

logger = logging.getLogger(__name__)

# Check if Stripe is configured and should run in live/test API mode
is_configured = bool(settings.STRIPE_SECRET_KEY and not settings.STRIPE_SECRET_KEY.startswith("mock_"))

if is_configured:
    stripe.api_key = settings.STRIPE_SECRET_KEY


def create_stripe_customer(email: str, name: str) -> str:
    """
    Register a customer account with Stripe.
    If Stripe is unconfigured, registers and returns a mock customer ID.
    """
    if not is_configured:
        mock_id = f"cus_mock_{uuid.uuid4().hex[:12]}"
        logger.info(f"Stripe unconfigured. Generated mock customer ID: {mock_id} for user email {email}")
        return mock_id

    try:
        customer = stripe.Customer.create(email=email, name=name)
        return customer.id
    except Exception as e:
        logger.error(f"Failed to create Stripe customer for email {email}: {str(e)}")
        # Gracefully fall back to mock customer ID so signup doesn't block
        mock_id = f"cus_mock_{uuid.uuid4().hex[:12]}"
        return mock_id


def construct_stripe_event(payload: bytes, sig_header: str) -> dict:
    """
    Parse and verify signatures of incoming webhook events from Stripe.
    If Stripe webhook secret is missing, parses event payloads directly without signature checks.
    """
    # Check if signature verification should be skipped (development/testing)
    skip_signature = not bool(settings.STRIPE_WEBHOOK_SECRET and not settings.STRIPE_WEBHOOK_SECRET.startswith("mock_"))

    if skip_signature:
        logger.info("Stripe webhook verification bypassed. Decoding JSON payload directly.")
        try:
            # Safely parse raw JSON event payload
            event = json.loads(payload.decode("utf-8"))
            return event
        except Exception as e:
            raise ValueError(f"Failed to parse mock event payload: {str(e)}")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
        return event
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Stripe Webhook signature verification failed: {str(e)}")
        raise ValueError("Invalid Stripe Webhook signature.")
    except Exception as e:
        logger.error(f"Stripe Webhook parsing error: {str(e)}")
        raise ValueError(f"Webhook parsing error: {str(e)}")
