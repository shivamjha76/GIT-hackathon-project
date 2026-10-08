import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal
from .models import Repository, Finding, ScanRun, Allowlist
from .detector import scan_patch
from .notifier import dispatch_alert

logger = logging.getLogger(__name__)

def get_github_headers(etag: Optional[str] = None) -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SecretWatch-Scanner/1.0"
    }
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    if etag:
        headers["If-None-Match"] = etag
    return headers

async def fetch_repo_details(client: httpx.AsyncClient, owner: str, name: str) -> Optional[Dict[str, Any]]:
    """Fetches public repo metadata from GitHub."""
    url = f"https://api.github.com/repos/{owner}/{name}"
    resp = await client.get(url, headers=get_github_headers())
    if resp.status_code == 200:
        return resp.json()
    return None

async def scan_single_commit(
    client: httpx.AsyncClient,
    db: Session,
    repo: Repository,
    commit_sha: str,
    commit_msg: str,
    commit_url: str
) -> int:
    """Fetches diff for a commit and scans added lines for secrets."""
    url = f"https://api.github.com/repos/{repo.owner}/{repo.name}/commits/{commit_sha}"
    resp = await client.get(url, headers=get_github_headers())
    if resp.status_code != 200:
        logger.warning(f"Could not fetch commit {commit_sha} for {repo.full_name}: HTTP {resp.status_code}")
        return 0

    commit_data = resp.json()
    files = commit_data.get("files", [])
    new_findings_count = 0

    for file_info in files:
        file_path = file_info.get("filename", "")
        patch = file_info.get("patch", "")
        if not patch:
            continue

        raw_findings = scan_patch(patch, repo.full_name, file_path)
        for item in raw_findings:
            # Check if this fingerprint already recorded for this commit
            existing = db.query(Finding).filter(
                Finding.repo_id == repo.id,
                Finding.commit_sha == commit_sha,
                Finding.fingerprint == item["fingerprint"]
            ).first()

            if existing:
                continue

            # Record finding into DB
            finding = Finding(
                repo_id=repo.id,
                commit_sha=commit_sha,
                commit_message=commit_msg[:250] if commit_msg else "",
                commit_url=commit_url,
                file_path=file_path,
                line_no=item["line_no"],
                secret_type=item["secret_type"],
                severity=item["severity"],
                confidence=item["confidence"],
                entropy_score=item["entropy_score"],
                pattern_matched=item["pattern_matched"],
                masked_value=item["masked_value"],
                fingerprint=item["fingerprint"],
                status="open",
                remediation=item["remediation"],
                detected_at=datetime.now(timezone.utc)
            )
            db.add(finding)
            db.commit()
            db.refresh(finding)
            new_findings_count += 1

            # Dispatch real-time alert (Discord/Slack)
            alert_payload = {
                "severity": item["severity"],
                "secret_type": item["secret_type"],
                "masked_value": item["masked_value"],
                "file_path": file_path,
                "line_no": item["line_no"],
                "remediation": item["remediation"]
            }
            alert_sent = await dispatch_alert(alert_payload, repo.full_name, commit_sha, commit_url)
            if alert_sent:
                finding.alerted_at = datetime.now(timezone.utc)
                db.commit()

    return new_findings_count

async def poll_repository(db: Session, repo: Repository, force: bool = False) -> Dict[str, Any]:
    """
    Polls GitHub for new commits on a repository.
    Handles conditional ETag requests to save GitHub rate limit.
    """
    repo.status = "Scanning"
    repo.error_message = None
    db.commit()

    scan_run = ScanRun(
        repo_id=repo.id,
        started_at=datetime.now(timezone.utc)
    )
    db.add(scan_run)
    db.commit()

    headers = get_github_headers(None if force else repo.etag)
    url = f"https://api.github.com/repos/{repo.owner}/{repo.name}/commits"
    params = {"per_page": 10}

    total_findings_added = 0
    commits_scanned_count = 0

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers, params=params)

            # Rate limit or 304 Not Modified
            if resp.status_code == 304 and not force:
                logger.debug(f"Repo {repo.full_name} unchanged (304 Not Modified)")
                repo.status = "Idle"
                repo.last_scanned_at = datetime.now(timezone.utc)
                scan_run.finished_at = datetime.now(timezone.utc)
                db.commit()
                return {"status": "unchanged", "findings": 0}

            if resp.status_code == 403:
                rate_limit_msg = "Rate limit reached. Configure GITHUB_TOKEN in backend .env."
                repo.status = "Error"
                repo.error_message = rate_limit_msg
                scan_run.error = rate_limit_msg
                scan_run.finished_at = datetime.now(timezone.utc)
                db.commit()
                return {"status": "error", "error": rate_limit_msg}

            if resp.status_code == 404:
                err = "Repository not found or private."
                repo.status = "Error"
                repo.error_message = err
                scan_run.error = err
                scan_run.finished_at = datetime.now(timezone.utc)
                db.commit()
                return {"status": "error", "error": err}

            if resp.status_code != 200:
                err = f"GitHub API error: HTTP {resp.status_code}"
                repo.status = "Error"
                repo.error_message = err
                scan_run.error = err
                scan_run.finished_at = datetime.now(timezone.utc)
                db.commit()
                return {"status": "error", "error": err}

            commits = resp.json()
            if not isinstance(commits, list) or len(commits) == 0:
                repo.status = "Idle"
                repo.last_scanned_at = datetime.now(timezone.utc)
                scan_run.finished_at = datetime.now(timezone.utc)
                db.commit()
                return {"status": "no_commits", "findings": 0}

            new_etag = resp.headers.get("ETag")
            latest_commit_sha = commits[0]["sha"]

            # Process new commits until last_seen_sha
            commits_to_scan = []
            for c in commits:
                if not force and repo.last_seen_sha and c["sha"] == repo.last_seen_sha:
                    break
                commits_to_scan.append(c)

            # If it's the very first time adding repo and no last_seen_sha, scan the latest 3 commits
            if not repo.last_seen_sha and len(commits_to_scan) > 3 and not force:
                commits_to_scan = commits_to_scan[:3]

            commits_scanned_count = len(commits_to_scan)
            for c in reversed(commits_to_scan):
                c_sha = c["sha"]
                c_msg = c.get("commit", {}).get("message", "")
                c_url = c.get("html_url", "")
                count = await scan_single_commit(client, db, repo, c_sha, c_msg, c_url)
                total_findings_added += count

            repo.last_seen_sha = latest_commit_sha
            repo.etag = new_etag
            repo.status = "Idle"
            repo.last_scanned_at = datetime.now(timezone.utc)

            scan_run.finished_at = datetime.now(timezone.utc)
            scan_run.commits_scanned = commits_scanned_count
            scan_run.findings_count = total_findings_added
            db.commit()

            return {
                "status": "success",
                "commits_scanned": commits_scanned_count,
                "findings": total_findings_added
            }

    except Exception as e:
        logger.exception(f"Exception polling repo {repo.full_name}: {str(e)}")
        repo.status = "Error"
        repo.error_message = str(e)
        scan_run.error = str(e)
        scan_run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "error", "error": str(e)}

async def run_poller_daemon():
    """Background worker loop running every POLL_INTERVAL_SECONDS."""
    logger.info("Starting SecretWatch poller daemon...")
    while True:
        try:
            db = SessionLocal()
            try:
                active_repos = db.query(Repository).filter(Repository.is_active == True).all()
                for repo in active_repos:
                    try:
                        await poll_repository(db, repo)
                    except Exception as ex:
                        logger.error(f"Error polling repo {repo.full_name}: {ex}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Poller daemon loop exception: {e}")

        await asyncio.sleep(settings.POLL_INTERVAL_SECONDS)
