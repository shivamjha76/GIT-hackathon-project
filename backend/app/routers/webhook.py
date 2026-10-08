import hmac
import hashlib
import logging
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
import httpx

from ..config import settings
from ..database import get_db
from ..models import Repository
from ..poller import scan_single_commit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhook", tags=["Webhook"])

def verify_github_signature(payload_body: bytes, signature_header: str) -> bool:
    """Verifies X-Hub-Signature-256 header using HMAC-SHA256 constant-time comparison."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected_sig = signature_header.split("sha256=")[1]
    computed_sig = hmac.new(
        settings.WEBHOOK_SECRET.encode("utf-8"),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_sig, computed_sig)

async def process_push_event_payload(payload: dict, db: Session):
    repo_data = payload.get("repository", {})
    full_name = repo_data.get("full_name", "").lower()
    commits = payload.get("commits", [])

    if not full_name or not commits:
        return

    repo = db.query(Repository).filter(Repository.full_name == full_name).first()
    if not repo:
        # Auto-register if not monitored yet
        owner = repo_data.get("owner", {}).get("name") or repo_data.get("owner", {}).get("login", "unknown")
        name = repo_data.get("name", "unknown")
        repo = Repository(
            owner=owner,
            name=name,
            full_name=full_name,
            description=repo_data.get("description") or f"Auto-registered via webhook {full_name}",
            status="Idle"
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)

    async with httpx.AsyncClient(timeout=15.0) as client:
        for c in commits:
            c_sha = c.get("id")
            c_msg = c.get("message", "")
            c_url = c.get("url", "")
            if c_sha:
                await scan_single_commit(client, db, repo, c_sha, c_msg, c_url)

@router.post("/github")
async def github_webhook_receiver(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str = Header(None),
    x_github_event: str = Header(None),
    db: Session = Depends(get_db)
):
    body_bytes = await request.body()

    # In production/demo, if secret is enabled, verify HMAC signature
    if settings.WEBHOOK_SECRET and x_hub_signature_256:
        if not verify_github_signature(body_bytes, x_hub_signature_256):
            logger.warning("Invalid GitHub webhook signature received!")
            raise HTTPException(status_code=401, detail="Invalid HMAC-SHA256 signature")

    if x_github_event == "ping":
        return {"message": "Webhook ping received successfully"}

    if x_github_event == "push":
        payload = await request.json()
        background_tasks.add_task(process_push_event_payload, payload, db)
        return {"message": "Push event received and scheduled for scanning"}

    return {"message": f"Event {x_github_event} ignored"}
