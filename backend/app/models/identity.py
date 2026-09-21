import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class IdentityCheck(Base):
    __tablename__ = "identity_checks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    identifier_type = Column(String, nullable=False)  # 'email' | 'domain'
    identifier_value = Column(String, nullable=False)
    verification_token = Column(String, nullable=False)
    verification_status = Column(String, nullable=False, default="pending")  # 'pending' | 'verified'
    verified_at = Column(DateTime, nullable=True)
    last_checked_at = Column(DateTime, nullable=True)
    breach_results = Column(JSON, nullable=True)  # stores json results list from HIBP
    otp_expires_at = Column(DateTime, nullable=True)

    # Relationship back to Organization if needed
    organization = relationship("Organization")
