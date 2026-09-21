"""
Analytics models for the self-hosted visitor and API-key usage tracking system.

PRIVACY NOTE:
  - Raw IP addresses are NEVER persisted anywhere in this module.
  - visitor_hash = sha256(ip + daily_salt), where daily_salt rotates every UTC day.
  - After the salt rotates, the hash cannot be reverse-mapped to the original IP.
  - This allows same-day unique-visitor counting with no long-term IP retention.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, Index, Date, Float
from app.core.database import Base


class PageVisit(Base):
    """
    One row per tracked HTTP request to the CyberGuardian platform.
    Raw rows are kept for 90 days, then aggregated into DailyVisitSummary
    and deleted by the nightly Celery retention task.
    """
    __tablename__ = "page_visits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Which subdomain received the request (e.g. "app", "docs", "api", "www", "blog")
    subdomain = Column(String, nullable=False, index=True)

    # URL path (e.g. "/dashboard", "/docs/quickstart")
    path = Column(String, nullable=False)

    # HTTP method (GET, POST, …)
    method = Column(String, nullable=False, default="GET")

    # sha256(ip + daily_salt) — see privacy note above
    visitor_hash = Column(String, nullable=False, index=True)

    # Optional metadata collected from request headers
    referrer = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    # Coarse geo derived from IP BEFORE hashing (e.g. "IN", "US") — country code only
    country = Column(String, nullable=True)

    # Indexed for all date-range and subdomain+date queries
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)

    # Composite index: all analytics queries filter/group by (subdomain, created_at)
    __table_args__ = (
        Index("ix_page_visits_subdomain_created_at", "subdomain", "created_at"),
    )


class DailyVisitSummary(Base):
    """
    Pre-aggregated daily visit summary row.
    Created by the 90-day Celery retention task when it sweeps and deletes
    old raw PageVisit rows. Kept indefinitely to preserve historical trends.
    """
    __tablename__ = "daily_visit_summaries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # The calendar date this summary covers (UTC)
    date = Column(Date, nullable=False, index=True)

    # Subdomain this summary covers
    subdomain = Column(String, nullable=False, index=True)

    # Total page views (rows) for this subdomain on this date
    visit_count = Column(Integer, nullable=False, default=0)

    # Count of distinct visitor_hash values — approximates unique visitors
    unique_visitor_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_daily_visit_summaries_date_subdomain", "date", "subdomain"),
    )


class ApiKeyUsage(Base):
    """
    One row per authenticated API key call.
    Lets orgs (and platform admins) see call volume per key over time.
    Created by the API key authentication dependency after each successful call.
    """
    __tablename__ = "api_key_usages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Identifier of the key that was used — string FK (no FK constraint to keep simple)
    api_key_id = Column(String, nullable=False, index=True)

    # Human-readable key name at time of call (denormalised for query convenience)
    api_key_name = Column(String, nullable=True)

    # Which endpoint was called and the HTTP method
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False, default="GET")

    # Response status code (recorded AFTER the response is sent)
    status_code = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)

    __table_args__ = (
        Index("ix_api_key_usages_key_created_at", "api_key_id", "created_at"),
    )
