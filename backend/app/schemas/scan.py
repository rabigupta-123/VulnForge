from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ScanCreate(BaseModel):
    asset_id: str
    scan_type: Optional[str] = "vulnerability"  # vulnerability | pentest | strix


class ScanResponse(BaseModel):
    id: str
    asset_id: str
    triggered_by: Optional[str] = None
    status: str
    scan_type: str = "vulnerability"
    status_detail: Optional[str] = None
    risk_score: Optional[int] = None
    execution_log: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FindingResponse(BaseModel):
    id: str
    scan_id: str
    category: str
    severity: str
    title: str
    description: str
    remediation: str
    cvss_score: Optional[float] = None
    owasp_mapping: Optional[str] = None
    mitre_mapping: Optional[str] = None
    exec_summary: Optional[str] = None
    verified_by_poc: bool = False
    status: str = "open"
    status_note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FindingStatusUpdate(BaseModel):
    status: str  # "open" | "accepted_risk" | "false_positive"
    note: Optional[str] = None

