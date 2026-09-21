"""
SQLAlchemy models for Bug Bounty Program management and researcher workflow.
Model list:
- BountyProgram
- BountyScope
- RewardTier
- Researcher
- VulnerabilityReport
- ReportAttachment
- ReportComment
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, ForeignKey, DateTime, Integer, Float, Boolean, JSON
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class BountyProgram(Base):
    __tablename__ = "bounty_programs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="draft", nullable=False)  # draft | active | paused | closed
    visibility = Column(String(32), default="public", nullable=False)  # public | private | invite_only
    safe_harbor_text = Column(Text, nullable=False)  # Legal authorization statement
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    scopes = relationship("BountyScope", back_populates="program", cascade="all, delete-orphan")
    reward_tiers = relationship("RewardTier", back_populates="program", cascade="all, delete-orphan")
    reports = relationship("VulnerabilityReport", back_populates="program", cascade="all, delete-orphan")


class BountyScope(Base):
    __tablename__ = "bounty_scopes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    program_id = Column(String(36), ForeignKey("bounty_programs.id", ondelete="CASCADE"), nullable=False)
    asset_type = Column(String(64), nullable=False)  # domain | api | mobile_app | other
    target = Column(String(255), nullable=False)     # e.g. *.example.com, api.example.com
    in_scope = Column(Boolean, default=True, nullable=False)  # True = in-scope, False = explicit exclusion
    notes = Column(Text, nullable=True)

    program = relationship("BountyProgram", back_populates="scopes")
    reports = relationship("VulnerabilityReport", back_populates="affected_scope")


class RewardTier(Base):
    __tablename__ = "bounty_reward_tiers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    program_id = Column(String(36), ForeignKey("bounty_programs.id", ondelete="CASCADE"), nullable=False)
    severity = Column(String(32), nullable=False)  # critical | high | medium | low
    min_amount = Column(Float, default=0.0, nullable=False)
    max_amount = Column(Float, default=0.0, nullable=False)
    currency = Column(String(10), default="USD", nullable=False)

    program = relationship("BountyProgram", back_populates="reward_tiers")


class Researcher(Base):
    __tablename__ = "researchers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    reputation_score = Column(Integer, default=0, nullable=False)
    total_earned = Column(Float, default=0.0, nullable=False)
    total_reports = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    reports = relationship("VulnerabilityReport", back_populates="researcher")


class VulnerabilityReport(Base):
    __tablename__ = "vulnerability_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    program_id = Column(String(36), ForeignKey("bounty_programs.id", ondelete="CASCADE"), nullable=False)
    researcher_id = Column(String(36), ForeignKey("researchers.id", ondelete="CASCADE"), nullable=False)
    affected_scope_id = Column(String(36), ForeignKey("bounty_scopes.id", ondelete="RESTRICT"), nullable=False)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    steps_to_reproduce = Column(Text, nullable=False)
    severity_claimed = Column(String(32), nullable=False)  # critical | high | medium | low | info
    severity_confirmed = Column(String(32), nullable=True)
    cvss_score = Column(Float, nullable=True)
    
    status = Column(String(32), default="submitted", nullable=False)
    # submitted | triaging | accepted | duplicate | informative | not_applicable | resolved | disclosed
    
    reward_amount = Column(Float, nullable=True)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    triaged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    disclosure_eligible_at = Column(DateTime, nullable=True)

    program = relationship("BountyProgram", back_populates="reports")
    researcher = relationship("Researcher", back_populates="reports")
    affected_scope = relationship("BountyScope", back_populates="reports")
    attachments = relationship("ReportAttachment", back_populates="report", cascade="all, delete-orphan")
    comments = relationship("ReportComment", back_populates="report", cascade="all, delete-orphan")


class ReportAttachment(Base):
    __tablename__ = "bounty_report_attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), ForeignKey("vulnerability_reports.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    report = relationship("VulnerabilityReport", back_populates="attachments")


class ReportComment(Base):
    __tablename__ = "bounty_report_comments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), ForeignKey("vulnerability_reports.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False, nullable=False)  # True = internal triager note, False = researcher-visible
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    report = relationship("VulnerabilityReport", back_populates="comments")
    author = relationship("User")
