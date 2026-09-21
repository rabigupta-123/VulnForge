from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class IdentityEmailCreate(BaseModel):
    email: str


class IdentityPhoneCreate(BaseModel):
    phone: str


class IdentityPhoneConfirm(BaseModel):
    phone: str
    otp_code: str


class PasswordCheckPayload(BaseModel):
    prefix: str  # first 5 characters of SHA-1 hash


class PasswordCheckResponse(BaseModel):
    suffixes: List[str]  # HIBP suffixes (SUFFIX:COUNT list)


class IdentityCheckResponse(BaseModel):
    id: str
    org_id: str
    identifier_type: str  # 'email' | 'domain'
    identifier_value: str
    verification_token: str
    verification_status: str  # 'pending' | 'verified'
    verified_at: Optional[datetime] = None
    last_checked_at: Optional[datetime] = None
    breach_results: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(from_attributes=True)
