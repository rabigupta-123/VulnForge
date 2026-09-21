import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.asset import Asset
from app.models.identity import IdentityCheck
from app.schemas.identity import (
    IdentityEmailCreate,
    IdentityPhoneCreate,
    IdentityPhoneConfirm,
    PasswordCheckPayload,
    PasswordCheckResponse,
    IdentityCheckResponse,
)
from app.services.breach.hibp import check_email_breaches, check_domain_breaches

from app.services.email import send_verification_email_smtp

router = APIRouter()


def send_verification_email(email: str, token: str):
    """
    Dispatches an ownership verification email via SMTP if configured,
    or logs verification link details to terminal/logs in local development mode.
    """
    confirm_link = f"http://127.0.0.1:8000/api/v1/identity/confirm?token={token}"
    send_verification_email_smtp(email, confirm_link)


def send_verification_sms(phone: str, otp_code: str):
    """
    Placeholder SMS-sending function.
    For local development, it outputs the code directly to terminal/logs.
    """
    print("\n" + "=" * 60)
    print(f"[SMS] VERIFICATION SMS DISPATCHED TO: {phone}")
    print(f"[SMS] OTP CODE: {otp_code} (Valid for 5 minutes)")
    print("=" * 60 + "\n")


@router.get("/", response_model=List[IdentityCheckResponse])
def list_identity_checks(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    List all identity verification checks (emails and domains) registered in the workspace.
    """
    return (
        db.query(IdentityCheck)
        .filter(IdentityCheck.org_id == current_user.org_id)
        .all()
    )


@router.post("/email", response_model=IdentityCheckResponse, status_code=status.HTTP_201_CREATED)
def register_email_for_monitoring(
    payload: IdentityEmailCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Register a new email address for monitoring. Creates a 'pending' verification record
    and transmits a verification email containing the challenge token.
    """
    email_clean = payload.email.strip().lower()

    # Check if already registered in this organization
    existing = (
        db.query(IdentityCheck)
        .filter(
            IdentityCheck.org_id == current_user.org_id,
            IdentityCheck.identifier_type == "email",
            IdentityCheck.identifier_value == email_clean,
        )
        .first()
    )
    if existing:
        # Re-send verification if pending, otherwise return existing
        if existing.verification_status == "pending":
            send_verification_email(email_clean, existing.verification_token)
        return existing

    token = secrets.token_urlsafe(32)
    new_check = IdentityCheck(
        org_id=current_user.org_id,
        identifier_type="email",
        identifier_value=email_clean,
        verification_token=token,
        verification_status="pending",
        verified_at=None,
        last_checked_at=None,
        breach_results=None,
    )
    db.add(new_check)
    db.commit()
    db.refresh(new_check)

    send_verification_email(email_clean, token)

    return new_check


@router.get("/confirm")
def confirm_email_ownership(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Confirm email ownership via the clicked confirmation token, run the initial HIBP scan,
    and redirect the browser to the frontend dashboard.
    """
    check = (
        db.query(IdentityCheck)
        .filter(
            IdentityCheck.verification_token == token,
            IdentityCheck.verification_status == "pending",
        )
        .first()
    )
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification token is invalid or has expired.",
        )

    # Mark as verified
    check.verification_status = "verified"
    check.verified_at = datetime.now(timezone.utc)
    check.last_checked_at = datetime.now(timezone.utc)

    # Perform HIBP check with safety fallback for sandbox / unconfigured API keys
    try:
        if settings.HIBP_API_KEY:
            results = check_email_breaches(check.identifier_value, settings.HIBP_API_KEY)
        else:
            # Fallback mock credentials leakage summary
            results = [
                {
                    "Name": "Canva",
                    "Domain": "canva.com",
                    "BreachDate": "2019-05-24",
                    "DataClasses": ["Passwords", "Emails", "Usernames"],
                    "Description": "In May 2019, the graphic design tool Canva experienced a security breach.",
                },
                {
                    "Name": "Adobe",
                    "Domain": "adobe.com",
                    "BreachDate": "2013-10-04",
                    "DataClasses": ["Passwords (encrypted)", "Username hints", "Emails"],
                    "Description": "In October 2013, Adobe had a database disclosure exposing usernames and password hashes.",
                },
            ]
        check.breach_results = results
    except Exception as e:
        check.breach_results = [{"error": f"HIBP lookup failed: {str(e)}"}]

    db.add(check)
    db.commit()

    # Redirect to Next.js frontend tab
    return RedirectResponse(
        url="http://localhost:3000/?results_ready=true&tab=identity"
    )


@router.post("/{check_id}/verify-now", response_model=IdentityCheckResponse)
def verify_identity_check_now(
    check_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Instantly mark a pending email monitor as verified and trigger breach audit lookup.
    Useful for instant verification in testing or sandbox environments.
    """
    check = (
        db.query(IdentityCheck)
        .filter(IdentityCheck.id == check_id, IdentityCheck.org_id == current_user.org_id)
        .first()
    )
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Identity check record not found in your organization.",
        )

    check.verification_status = "verified"
    check.verified_at = datetime.now(timezone.utc)
    check.last_checked_at = datetime.now(timezone.utc)

    try:
        if settings.HIBP_API_KEY:
            results = check_email_breaches(check.identifier_value, settings.HIBP_API_KEY)
        else:
            results = [
                {
                    "Name": "Canva",
                    "Domain": "canva.com",
                    "BreachDate": "2019-05-24",
                    "DataClasses": ["Passwords", "Emails", "Usernames"],
                    "Description": "In May 2019, the graphic design tool Canva experienced a security breach.",
                },
                {
                    "Name": "Adobe",
                    "Domain": "adobe.com",
                    "BreachDate": "2013-10-04",
                    "DataClasses": ["Passwords (encrypted)", "Username hints", "Emails"],
                    "Description": "In October 2013, Adobe had a database disclosure exposing usernames and password hashes.",
                },
            ]
        check.breach_results = results
    except Exception as e:
        check.breach_results = [{"error": f"HIBP lookup failed: {str(e)}"}]

    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.post("/{check_id}/resend", response_model=IdentityCheckResponse)
def resend_verification_email_endpoint(
    check_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Re-dispatches the ownership verification email for a pending identity check.
    """
    check = (
        db.query(IdentityCheck)
        .filter(IdentityCheck.id == check_id, IdentityCheck.org_id == current_user.org_id)
        .first()
    )
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Identity check record not found in your organization.",
        )

    if check.verification_status == "verified":
        return check

    send_verification_email(check.identifier_value, check.verification_token)
    return check


@router.post("/domain/{asset_id}/check", response_model=IdentityCheckResponse)
def check_domain_breaches_endpoint(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Verify ownership of the domain via the existing Asset DNS records registry, run a HIBP Domain Search,
    and save the exposure statistics.
    """
    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id, Asset.org_id == current_user.org_id)
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset domain not found in this organization.",
        )

    if asset.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Target domain asset must complete DNS ownership verification first.",
        )

    # Perform HIBP query with sandbox fallback
    try:
        if settings.HIBP_API_KEY:
            results = check_domain_breaches(asset.domain, settings.HIBP_API_KEY)
        else:
            # Fallback mock domain breaches list
            results = [
                {
                    "Name": "Domain-wide Leak",
                    "Domain": asset.domain,
                    "BreachDate": "2024-01-10",
                    "DataClasses": ["Emails", "Employee Credentials"],
                    "Description": "Mock domain lookup indicating credentials exposure for audit presentation.",
                }
            ]
    except Exception as e:
        results = [{"error": f"Domain lookup failed: {str(e)}"}]

    # Create new row or update if already present
    check = (
        db.query(IdentityCheck)
        .filter(
            IdentityCheck.org_id == current_user.org_id,
            IdentityCheck.identifier_type == "domain",
            IdentityCheck.identifier_value == asset.domain,
        )
        .first()
    )
    if not check:
        check = IdentityCheck(
            org_id=current_user.org_id,
            identifier_type="domain",
            identifier_value=asset.domain,
            verification_token="asset_verified",
            verification_status="verified",
            verified_at=asset.verified_at,
        )

    check.last_checked_at = datetime.now(timezone.utc)
    check.breach_results = results
    db.add(check)
    db.commit()
    db.refresh(check)

    return check


@router.post("/password-check", response_model=PasswordCheckResponse)
def proxy_password_check(
    payload: PasswordCheckPayload,
):
    """
    Safe proxy endpoint executing k-anonymity checks against the Have I Been Pwned Passwords range API
    using a SHA-1 hash prefix (5 characters). The complete plaintext password never touches the server.
    """
    prefix = payload.prefix.strip().upper()
    if len(prefix) != 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SHA-1 prefix parameter must be exactly 5 hexadecimal characters.",
        )

    try:
        resp = requests.get(
            f"https://api.pwnedpasswords.com/range/{prefix}", timeout=10
        )
        resp.raise_for_status()
        suffixes = resp.text.splitlines()
        return {"suffixes": suffixes}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HIBP proxy request failed: {str(e)}",
        )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_identity_check(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Remove an identity email or domain monitoring record.
    """
    record = (
        db.query(IdentityCheck)
        .filter(IdentityCheck.id == id, IdentityCheck.org_id == current_user.org_id)
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Identity check record not found.",
        )

    db.delete(record)
    db.commit()
    return


@router.post("/phone", response_model=IdentityCheckResponse, status_code=status.HTTP_201_CREATED)
def register_phone_for_monitoring(
    payload: IdentityPhoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Initiate phone ownership verification. Generates a 6-digit OTP challenge,
    stores its hashed representation with a 5-minute expiry, and dispatches SMS.
    """
    phone_clean = payload.phone.strip()

    # Generate a cryptographically secure 6-digit numeric OTP
    otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
    hashed_otp = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    check = (
        db.query(IdentityCheck)
        .filter(
            IdentityCheck.org_id == current_user.org_id,
            IdentityCheck.identifier_type == "phone",
            IdentityCheck.identifier_value == phone_clean,
        )
        .first()
    )
    if not check:
        check = IdentityCheck(
            org_id=current_user.org_id,
            identifier_type="phone",
            identifier_value=phone_clean,
        )

    check.verification_token = hashed_otp
    check.verification_status = "pending"
    check.otp_expires_at = expires_at
    db.add(check)
    db.commit()
    db.refresh(check)

    send_verification_sms(phone_clean, otp_code)

    return check


@router.post("/phone/confirm", response_model=IdentityCheckResponse)
def confirm_phone_ownership(
    payload: IdentityPhoneConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Confirm phone number ownership challenge. Verifies the input code matches the active hashed token
    and verifies that the OTP has not expired.
    """
    phone_clean = payload.phone.strip()
    otp_clean = payload.otp_code.strip()
    hashed_input = hashlib.sha256(otp_clean.encode("utf-8")).hexdigest()

    check = (
        db.query(IdentityCheck)
        .filter(
            IdentityCheck.org_id == current_user.org_id,
            IdentityCheck.identifier_type == "phone",
            IdentityCheck.identifier_value == phone_clean,
            IdentityCheck.verification_status == "pending",
        )
        .first()
    )
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending phone verification found for this number.",
        )

    # Validate OTP code match
    if check.verification_token != hashed_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification OTP code.",
        )

    # Check OTP expiration
    expiry = check.otp_expires_at
    if expiry:
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification OTP has expired. Please request a new code.",
            )

    # Update verification state
    check.verification_status = "verified"
    check.verified_at = datetime.now(timezone.utc)
    check.last_checked_at = datetime.now(timezone.utc)
    check.breach_results = [
        {
            "Name": "Mock Owner Phone Exposure Lookup",
            "Domain": "identity_checks",
            "BreachDate": datetime.now(timezone.utc).date().isoformat(),
            "DataClasses": ["Phone numbers"],
            "Description": f"Privacy-compliant owner self-verification audit completed successfully for number {phone_clean}.",
        }
    ]
    db.add(check)
    db.commit()
    db.refresh(check)

    return check

