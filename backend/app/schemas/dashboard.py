from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class RecentScanItem(BaseModel):
    id: str
    domain: str
    status: str
    risk_score: Optional[int] = None
    started_at: datetime
    completed_at: Optional[datetime] = None


class DashboardOverviewResponse(BaseModel):
    total_assets: int
    total_scans: int
    critical_findings: int
    high_findings: int
    medium_findings: int
    low_findings: int
    info_findings: int
    average_risk_score: float
    recent_scans: List[RecentScanItem]
