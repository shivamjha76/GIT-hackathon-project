import re
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Repository, Finding
from ..schemas import RepositoryCreate, RepositoryResponse
from ..poller import poll_repository

router = APIRouter(prefix="/api/repos", tags=["Repositories"])

def format_repo_response(repo: Repository, db: Session) -> dict:
    findings = db.query(Finding).filter(Finding.repo_id == repo.id, Finding.status == "open").all()
    breakdown = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for f in findings:
        if f.severity in breakdown:
            breakdown[f.severity] += 1

    return {
        "id": repo.id,
        "owner": repo.owner,
        "name": repo.name,
        "full_name": repo.full_name,
        "description": repo.description,
        "added_by": repo.added_by,
        "interval_seconds": repo.interval_seconds,
        "last_seen_sha": repo.last_seen_sha,
        "is_active": repo.is_active,
        "status": repo.status,
        "error_message": repo.error_message,
        "last_scanned_at": repo.last_scanned_at,
        "created_at": repo.created_at,
        "open_findings_count": len(findings),
        "severity_breakdown": breakdown
    }

@router.get("", response_model=List[RepositoryResponse])
def get_all_repositories(db: Session = Depends(get_db)):
    repos = db.query(Repository).order_by(Repository.id.desc()).all()
    return [format_repo_response(r, db) for r in repos]

@router.post("", response_model=RepositoryResponse)
async def add_repository(
    payload: RepositoryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    raw_input = payload.repo_url_or_name.strip()
    
    # Clean github.com/owner/repo or owner/repo
    raw_input = re.sub(r"^https?://github\.com/", "", raw_input)
    raw_input = raw_input.strip("/")

    parts = raw_input.split("/")
    if len(parts) == 2:
        owner, name = parts[0], parts[1]
    elif len(parts) == 1:
        # User supplied a username/repo without slash, or an owner
        raise HTTPException(
            status_code=400,
            detail="Please specify repository as 'owner/repo' format (e.g. facebook/react)"
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid repository format.")

    full_name = f"{owner}/{name}".lower()

    existing = db.query(Repository).filter(Repository.full_name == full_name).first()
    if existing:
        return format_repo_response(existing, db)

    repo = Repository(
        owner=owner,
        name=name,
        full_name=full_name,
        description=payload.description or f"Monitored repository {full_name}",
        status="Idle"
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    # Trigger initial scan in background
    background_tasks.add_task(poll_repository, db, repo, True)

    return format_repo_response(repo, db)

@router.delete("/{repo_id}")
def delete_repository(repo_id: int, db: Session = Depends(get_db)):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    db.delete(repo)
    db.commit()
    return {"message": f"Repository {repo.full_name} deleted successfully"}

@router.post("/{repo_id}/scan")
async def trigger_repo_scan(
    repo_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Run scan
    res = await poll_repository(db, repo, force=True)
    return {"message": "Scan completed", "result": res}

@router.post("/scan-all")
async def trigger_scan_all(db: Session = Depends(get_db)):
    repos = db.query(Repository).filter(Repository.is_active == True).all()
    results = []
    for r in repos:
        res = await poll_repository(db, r, force=True)
        results.append({"repo": r.full_name, "result": res})
    return {"message": f"Scanned {len(repos)} repositories", "results": results}
