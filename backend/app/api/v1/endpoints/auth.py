from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.rate_limit import RateLimiter

from app.core import security
from app.core.database import get_db
from app.models.user import User, Organization
from app.schemas.user import UserCreate, UserResponse
from app.schemas.token import Token
from app.api import deps

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(3, 60))])
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    Creates a corresponding Organization workspace and sets the user's role to 'owner'.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered.",
        )

    # 1. Create default Organization
    from app.services.billing.stripe_service import create_stripe_customer
    org = Organization(name="Personal Workspace")
    db.add(org)
    db.flush()  # Generate org.id to associate with User

    # Create Stripe Customer (mock/live) and save customer ID
    cust_id = create_stripe_customer(user_in.email, org.name)
    org.stripe_customer_id = cust_id

    # 2. Create User linked to the organization
    hashed_password = security.get_password_hash(user_in.password)
    user = User(
        email=user_in.email,
        password_hash=hashed_password,
        role="owner",  # The user who registers is the organization Owner by default
        org_id=org.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token, dependencies=[Depends(RateLimiter(5, 60))])
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    OAuth2 compatible token login, retrieve a JWT access token.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not user.password_hash or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = security.create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(deps.get_current_user)):
    """
    Get current logged in user details.
    """
    return current_user


@router.post("/oauth/{provider}", response_model=Token)
def oauth_login_stub(provider: str, code: str):
    """
    Stub endpoint for future OAuth validation (GitHub/Google).
    Returns a mocked token for proof of concept during early development phases.
    """
    if provider not in ["google", "github"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: {provider}",
        )
    # Return a mocked access token
    return {
        "access_token": "mocked_oauth_token_placeholder",
        "token_type": "bearer",
    }
