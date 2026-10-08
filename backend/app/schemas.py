from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class RepositoryBase(BaseModel):
    owner: str
    name: str
    description: Optional[str] = ""

class RepositoryCreate(BaseModel):
    repo_url_or_name: str  # Can accept 'owner/repo' or 'https://github.com/owner/repo' or 'username'
    description: Optional[str] = ""

class RepositoryResponse(BaseModel):
    id: int
    owner: str
    name: str
    full_name: str
    description: Optional[str]
    added_by: str
    interval_seconds: int
    last_seen_sha: Optional[str]
    is_active: bool
    status: str
    error_message: Optional[str]
    last_scanned_at: Optional[datetime]
    created_at: datetime
    # Severity breakdown counts for frontend cards
    open_findings_count: int = 0
    severity_breakdown: Dict[str, int] = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}

    class Config:
        from_attributes = True

class FindingResponse(BaseModel):
    id: int
    repo_id: int
    repo_name: str
    commit_sha: str
    commit_message: Optional[str]
    commit_url: Optional[str]
    file_path: str
    line_no: int
    secret_type: str
    severity: str
    confidence: str
    entropy_score: float
    pattern_matched: Optional[str]
    masked_value: str
    fingerprint: str
    status: str
    detected_at: datetime
    alerted_at: Optional[datetime]
    remediation: Optional[str]

    class Config:
        from_attributes = True

class FindingUpdateStatus(BaseModel):
    status: str  # open, resolved, false_positive

class StatsResponse(BaseModel):
    total_repositories: int
    open_findings: int
    critical_findings: int
    found_today: int
    findings_per_day: List[Dict[str, Any]]  # [{"day": "Mon", "count": 2}, ...]
    by_severity: Dict[str, int]             # {"Critical": 4, "High": 6, "Medium": 5, "Low": 3}
    recent_findings: List[FindingResponse]
