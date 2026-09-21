from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


class AssetBase(BaseModel):
    domain: str
    verification_method: str = "dns_txt"  # dns_txt | file_upload

    @field_validator("verification_method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        if v not in ["dns_txt", "file_upload"]:
            raise ValueError("verification_method must be either 'dns_txt' or 'file_upload'")
        return v


class AssetCreate(AssetBase):
    pass


class AssetResponse(AssetBase):
    id: str
    verification_token: str
    verification_status: str
    verified_at: Optional[datetime] = None
    github_repo: Optional[str] = None
    ci_token: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssetGitHubLink(BaseModel):
    github_repo: str  # e.g., "owner/repo"
    github_token: Optional[str] = None

