"""
Analytics aggregation endpoints.

All routes are admin-only — this is internal platform traffic data.
Uses SQLite-compatible date bucketing (strftime) with a PostgreSQL
date_trunc fallback when running on Postgres.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, distinct, text
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.analytics import PageVisit, DailyVisitSummary, ApiKeyUsage

router = APIRouter()

# ── Only users with role "owner" or "admin" may access these endpoints ────────
require_admin = deps.RoleChecker(allowed_roles=["owner", "admin"])


# ── Helper: compute the start-of-period datetime ─────────────────────────────
def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "daily":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "weekly":
        return (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    elif period == "monthly":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "yearly":
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="period must be one of: daily, weekly, monthly, yearly",
        )


def _bucket_format(period: str) -> str:
    """
    SQLite strftime format string for grouping rows by period.
    Postgres users should use date_trunc; SQLite uses strftime.
    """
    return {
        "daily": "%Y-%m-%d",
        "weekly": "%Y-%W",
        "monthly": "%Y-%m",
        "yearly": "%Y",
    }[period]


# ── Response schemas ──────────────────────────────────────────────────────────

class VisitorBucket(BaseModel):
    bucket: str
    total_views: int
    unique_visitors: int


class SubdomainBreakdown(BaseModel):
    subdomain: str
    visit_count: int
    unique_visitors: int
    pct_of_total: float


class TopPath(BaseModel):
    path: str
    visit_count: int
    unique_visitors: int


class ApiUsageBucket(BaseModel):
    bucket: str
    total_calls: int
    api_key_id: Optional[str] = None
    api_key_name: Optional[str] = None


# ── 1. Visitor time-series ────────────────────────────────────────────────────

@router.get(
    "/visitors",
    response_model=List[VisitorBucket],
    summary="Total visitors and page views bucketed by period",
)
def get_visitor_timeseries(
    period: str = Query("daily", description="daily | weekly | monthly | yearly"),
    subdomain: Optional[str] = Query(None, description="Filter to a single subdomain"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Returns total page views and distinct visitor_hash counts, grouped into
    time buckets for the chosen period.
    """
    since = _period_start(period)
    fmt = _bucket_format(period)

    q = db.query(
        func.strftime(fmt, PageVisit.created_at).label("bucket"),
        func.count(PageVisit.id).label("total_views"),
        func.count(distinct(PageVisit.visitor_hash)).label("unique_visitors"),
    ).filter(PageVisit.created_at >= since)

    if subdomain:
        q = q.filter(PageVisit.subdomain == subdomain)

    rows = (
        q.group_by(text("bucket"))
        .order_by(text("bucket"))
        .all()
    )

    return [
        VisitorBucket(bucket=r.bucket, total_views=r.total_views, unique_visitors=r.unique_visitors)
        for r in rows
    ]


# ── 2. Subdomain breakdown ────────────────────────────────────────────────────

@router.get(
    "/subdomains",
    response_model=List[SubdomainBreakdown],
    summary="Traffic breakdown by subdomain for the selected period",
)
def get_subdomain_breakdown(
    period: str = Query("daily"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Returns each subdomain's visit count, unique visitors, and % of total traffic.
    """
    since = _period_start(period)

    rows = (
        db.query(
            PageVisit.subdomain,
            func.count(PageVisit.id).label("visit_count"),
            func.count(distinct(PageVisit.visitor_hash)).label("unique_visitors"),
        )
        .filter(PageVisit.created_at >= since)
        .group_by(PageVisit.subdomain)
        .order_by(func.count(PageVisit.id).desc())
        .all()
    )

    total = sum(r.visit_count for r in rows) or 1  # avoid /0

    return [
        SubdomainBreakdown(
            subdomain=r.subdomain,
            visit_count=r.visit_count,
            unique_visitors=r.unique_visitors,
            pct_of_total=round(r.visit_count / total * 100, 2),
        )
        for r in rows
    ]


# ── 3. Top paths ──────────────────────────────────────────────────────────────

@router.get(
    "/top-paths",
    response_model=List[TopPath],
    summary="Most-visited paths, optionally filtered to a subdomain",
)
def get_top_paths(
    period: str = Query("daily"),
    subdomain: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = _period_start(period)

    q = db.query(
        PageVisit.path,
        func.count(PageVisit.id).label("visit_count"),
        func.count(distinct(PageVisit.visitor_hash)).label("unique_visitors"),
    ).filter(PageVisit.created_at >= since)

    if subdomain:
        q = q.filter(PageVisit.subdomain == subdomain)

    rows = (
        q.group_by(PageVisit.path)
        .order_by(func.count(PageVisit.id).desc())
        .limit(limit)
        .all()
    )

    return [
        TopPath(path=r.path, visit_count=r.visit_count, unique_visitors=r.unique_visitors)
        for r in rows
    ]


# ── 4. API key usage time-series ──────────────────────────────────────────────

@router.get(
    "/api-usage",
    response_model=List[ApiUsageBucket],
    summary="API key call volume over time",
)
def get_api_usage(
    period: str = Query("daily"),
    api_key_id: Optional[str] = Query(None, description="Filter to a specific API key"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Returns API call volume bucketed by period, optionally filtered to one key.
    Useful for tracking how actively an integration is being used.
    """
    since = _period_start(period)
    fmt = _bucket_format(period)

    q = db.query(
        func.strftime(fmt, ApiKeyUsage.created_at).label("bucket"),
        func.count(ApiKeyUsage.id).label("total_calls"),
        ApiKeyUsage.api_key_id,
        ApiKeyUsage.api_key_name,
    ).filter(ApiKeyUsage.created_at >= since)

    if api_key_id:
        q = q.filter(ApiKeyUsage.api_key_id == api_key_id)

    rows = (
        q.group_by(text("bucket"), ApiKeyUsage.api_key_id, ApiKeyUsage.api_key_name)
        .order_by(text("bucket"))
        .all()
    )

    return [
        ApiUsageBucket(
            bucket=r.bucket,
            total_calls=r.total_calls,
            api_key_id=r.api_key_id,
            api_key_name=r.api_key_name,
        )
        for r in rows
    ]


# ── 5. Sparkline: last-30-days call volume per API key ───────────────────────

class SparklinePoint(BaseModel):
    date: str
    calls: int


@router.get(
    "/api-usage/sparkline/{api_key_id}",
    response_model=List[SparklinePoint],
    summary="30-day daily call volume sparkline for a specific API key",
)
def get_api_key_sparkline(
    api_key_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Returns 30 days of daily call counts for the given API key.
    Used to render the sparkline chart on the Settings / API Keys page.
    """
    since = datetime.now(timezone.utc) - timedelta(days=30)

    rows = (
        db.query(
            func.strftime("%Y-%m-%d", ApiKeyUsage.created_at).label("date"),
            func.count(ApiKeyUsage.id).label("calls"),
        )
        .filter(
            ApiKeyUsage.api_key_id == api_key_id,
            ApiKeyUsage.created_at >= since,
        )
        .group_by(text("date"))
        .order_by(text("date"))
        .all()
    )

    return [SparklinePoint(date=r.date, calls=r.calls) for r in rows]


# ── 6. Internal: record a page visit (called from middleware) ─────────────────

class PageVisitCreate(BaseModel):
    subdomain: str
    path: str
    method: str = "GET"
    visitor_hash: str
    referrer: Optional[str] = None
    user_agent: Optional[str] = None
    country: Optional[str] = None
