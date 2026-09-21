import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import Organization
from app.services.billing.stripe_service import construct_stripe_event

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe Webhook endpoint to sync subscription states with database organization tiers.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = construct_stripe_event(payload, sig_header)
    except ValueError as e:
        logger.warning(f"Invalid webhook payload: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})
    customer_id = data_object.get("customer")

    if not customer_id:
        return {"status": "ignored", "reason": "No customer ID in event object"}

    # 1. Handle subscription creation and updates
    if event_type in ["customer.subscription.created", "customer.subscription.updated"]:
        org = db.query(Organization).filter(Organization.stripe_customer_id == customer_id).first()
        if org:
            # Detect tier from metadata or default to 'pro'
            tier = data_object.get("metadata", {}).get("tier", "pro")
            org.subscription_tier = tier.lower()
            db.commit()
            logger.info(f"Updated Organization {org.id} subscription tier to {org.subscription_tier}")
        else:
            logger.warning(f"No organization found matching stripe_customer_id: {customer_id}")

    # 2. Handle subscription cancellations
    elif event_type == "customer.subscription.deleted":
        org = db.query(Organization).filter(Organization.stripe_customer_id == customer_id).first()
        if org:
            org.subscription_tier = "free"
            db.commit()
            logger.info(f"Downgraded Organization {org.id} to free tier")
        else:
            logger.warning(f"No organization found matching stripe_customer_id: {customer_id}")

    return {"status": "success"}
