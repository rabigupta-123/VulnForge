import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    domain = Column(String, nullable=False, index=True)
    verification_method = Column(String, nullable=False, default="dns_txt")  # dns_txt | file_upload
    verification_token = Column(String, nullable=False)
    verification_status = Column(String, nullable=False, default="pending")  # pending | verified | failed
    verified_at = Column(DateTime, nullable=True)
    github_repo = Column(String, nullable=True)
    github_token = Column(String, nullable=True)
    ci_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    scans = relationship("Scan", back_populates="asset", cascade="all, delete-orphan")

