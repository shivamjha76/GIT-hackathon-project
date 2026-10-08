from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models import Finding, Repository
from ..schemas import FindingResponse, FindingUpdateStatus

router = APIRouter(prefix="/api/findings", tags=["Findings"])

def format_finding_item(f: Finding) -> dict:
    return {
        "id": f.id,
        "repo_id": f.repo_id,
        "repo_name": f.repository.full_name if f.repository else "unknown",
        "commit_sha": f.commit_sha,
        "commit_message": f.commit_message,
        "commit_url": f.commit_url,
        "file_path": f.file_path,
        "line_no": f.line_no,
        "secret_type": f.secret_type,
        "severity": f.severity,
        "confidence": f.confidence,
        "entropy_score": f.entropy_score,
        "pattern_matched": f.pattern_matched,
        "masked_value": f.masked_value,
        "fingerprint": f.fingerprint,
        "status": f.status,
        "detected_at": f.detected_at,
        "alerted_at": f.alerted_at,
        "remediation": f.remediation
    }

@router.get("", response_model=List[FindingResponse])
def get_findings(
    status: Optional[str] = Query(None, description="open, resolved, false_positive"),
    severity: Optional[str] = Query(None, description="Critical, High, Medium, Low"),
    secret_type: Optional[str] = Query(None),
    repo_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Finding).join(Repository)

    if status and status != "all":
        query = query.filter(Finding.status == status)
    if severity and severity != "all":
        query = query.filter(Finding.severity == severity)
    if secret_type and secret_type != "all":
        query = query.filter(Finding.secret_type == secret_type)
    if repo_id:
        query = query.filter(Finding.repo_id == repo_id)
    if search:
        search_fmt = f"%{search.lower()}%"
        query = query.filter(
            or_(
                Repository.full_name.ilike(search_fmt),
                Finding.file_path.ilike(search_fmt),
                Finding.secret_type.ilike(search_fmt),
                Finding.masked_value.ilike(search_fmt)
            )
        )

    findings = query.order_by(Finding.id.desc()).offset(skip).limit(limit).all()
    return [format_finding_item(f) for f in findings]

@router.get("/{finding_id}", response_model=FindingResponse)
def get_finding_by_id(finding_id: int, db: Session = Depends(get_db)):
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return format_finding_item(finding)

@router.patch("/{finding_id}", response_model=FindingResponse)
def update_finding_status(
    finding_id: int,
    payload: FindingUpdateStatus,
    db: Session = Depends(get_db)
):
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    valid_statuses = {"open", "resolved", "false_positive"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    finding.status = payload.status
    db.commit()
    db.refresh(finding)
    return format_finding_item(finding)
