import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text, JSON, Float, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.asset import Asset


class Scan(Base):
    __tablename__ = "scans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_id = Column(String(36), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    triggered_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="queued")  # queued | running | completed | failed
    status_detail = Column(Text, nullable=True)
    scan_type = Column(String, default="vulnerability", nullable=False)  # vulnerability | pentest
    risk_score = Column(Integer, nullable=True)
    execution_log = Column(Text, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    asset = relationship("Asset", back_populates="scans")
    findings = relationship("Finding", back_populates="scan", cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id = Column(String(36), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False)
    category = Column(String, nullable=False)       # headers | ssl | ports | owasp | ...
    severity = Column(String, nullable=False)        # info | low | medium | high | critical
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    remediation = Column(Text, nullable=True)
    raw_output = Column(JSON, nullable=True)
    ai_explanation = Column(Text, nullable=True)
    cvss_score = Column(Float, nullable=True)

    owasp_mapping = Column(String, nullable=True)
    mitre_mapping = Column(String, nullable=True)
    exec_summary = Column(Text, nullable=True)
    verified_by_poc = Column(Boolean, default=False, nullable=False)
    status = Column(String, nullable=False, default="open")  # open | accepted_risk | false_positive
    status_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    scan = relationship("Scan", back_populates="findings")

