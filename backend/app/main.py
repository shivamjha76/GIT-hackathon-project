import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base, SessionLocal
from .models import Repository, Finding
from .detector import mask_secret, compute_fingerprint, REMEDIATION_GUIDES
from .poller import run_poller_daemon
from .routers import repos, findings, stats, webhook

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("secretwatch")

def seed_demo_data():
    """Populates initial sample repositories and findings to mirror realistic student repositories."""
    db = SessionLocal()
    try:
        if db.query(Repository).count() > 0:
            return

        logger.info("Seeding initial student repositories and demo findings...")
        demo_repos = [
            {
                "owner": "rahul",
                "name": "ml-project",
                "full_name": "rahul-ml-project",
                "description": "Image classifier for college mini project",
                "status": "Scanning",
                "last_seen_sha": "a1b2c3d"
            },
            {
                "owner": "campus",
                "name": "chatbot",
                "full_name": "college-chatbot",
                "description": "Campus helpdesk chatbot using an AI API",
                "status": "Idle",
                "last_seen_sha": "d4e5f6a"
            },
            {
                "owner": "student",
                "name": "shop",
                "full_name": "ecommerce-api",
                "description": "FastAPI backend for a shopping app",
                "status": "Idle",
                "last_seen_sha": "7b8c9d0"
            },
            {
                "owner": "git-jaipur",
                "name": "hostel",
                "full_name": "hostel-manager",
                "description": "Hostel room and complaint tracker",
                "status": "Idle",
                "last_seen_sha": "1122334"
            },
            {
                "owner": "developer",
                "name": "portfolio",
                "full_name": "portfolio-site",
                "description": "Personal portfolio with a contact form",
                "status": "Error",
                "error_message": "Rate limit reached",
                "last_seen_sha": "5566778"
            },
            {
                "owner": "codingclub",
                "name": "quiz",
                "full_name": "quiz-app-react",
                "description": "Quiz app for the coding club",
                "status": "Idle",
                "last_seen_sha": "99aabbc"
            }
        ]

        now = datetime.now(timezone.utc)
        created_repos = {}
        for r_data in demo_repos:
            repo = Repository(
                owner=r_data["owner"],
                name=r_data["name"],
                full_name=r_data["full_name"],
                description=r_data["description"],
                status=r_data["status"],
                error_message=r_data.get("error_message"),
                last_seen_sha=r_data["last_seen_sha"],
                last_scanned_at=now - timedelta(seconds=20),
                created_at=now - timedelta(days=2)
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)
            created_repos[repo.full_name] = repo

        # Demo findings matching the screenshots
        demo_findings = [
            {
                "repo": "rahul-ml-project",
                "commit_sha": "a1b2c3d",
                "commit_msg": "add aws s3 dataset sync script",
                "file_path": "config/settings.py",
                "line_no": 12,
                "secret_type": "AWS key",
                "severity": "Critical",
                "confidence": "High",
                "entropy_score": 4.85,
                "raw_val": "AKIA1234567890SAMPLE",
                "remediation": REMEDIATION_GUIDES["AWS key"],
                "offset_minutes": 2
            },
            {
                "repo": "college-chatbot",
                "commit_sha": "f3392a1",
                "commit_msg": "initialize openai client for assistant",
                "file_path": "bot/ai.js",
                "line_no": 5,
                "secret_type": "OpenAI key",
                "severity": "High",
                "confidence": "High",
                "entropy_score": 4.72,
                "raw_val": "sk-proj-demo998877665544x9Qz",
                "remediation": REMEDIATION_GUIDES["OpenAI key"],
                "offset_minutes": 14
            },
            {
                "repo": "ecommerce-api",
                "commit_sha": "c8841e2",
                "commit_msg": "upload environment variables accidentally",
                "file_path": ".env",
                "line_no": 3,
                "secret_type": "GitHub token",
                "severity": "Critical",
                "confidence": "High",
                "entropy_score": 4.90,
                "raw_val": "ghp_abcdefghijklmnopqrstuvwxyz1234k2Lm",
                "remediation": REMEDIATION_GUIDES["GitHub token"],
                "offset_minutes": 41
            },
            {
                "repo": "hostel-manager",
                "commit_sha": "9a124c0",
                "commit_msg": "setup postgres connection pool",
                "file_path": "db/connect.py",
                "line_no": 7,
                "secret_type": "Database URL",
                "severity": "High",
                "confidence": "High",
                "entropy_score": 4.10,
                "raw_val": "postgres://admin:SuperSecretPass@host:5432/hostel",
                "remediation": REMEDIATION_GUIDES["Database URL"],
                "offset_minutes": 55
            },
            {
                "repo": "hostel-manager",
                "commit_sha": "3b291d5",
                "commit_msg": "send notifications on booking complaint",
                "file_path": "notify/hook.py",
                "line_no": 9,
                "secret_type": "Webhook URL",
                "severity": "Medium",
                "confidence": "High",
                "entropy_score": 3.95,
                "raw_val": "https://discord.com/api/webhooks/991203/secrettoken123",
                "remediation": REMEDIATION_GUIDES["Discord webhook URL"],
                "offset_minutes": 60
            },
            {
                "repo": "portfolio-site",
                "commit_sha": "0e599b1",
                "commit_msg": "mock auth token for testing",
                "file_path": "api/auth.js",
                "line_no": 22,
                "secret_type": "JWT",
                "severity": "Medium",
                "confidence": "High",
                "entropy_score": 4.60,
                "raw_val": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozS8Xf",
                "remediation": REMEDIATION_GUIDES["JWT"],
                "offset_minutes": 65
            },
            {
                "repo": "quiz-app-react",
                "commit_sha": "62cd081",
                "commit_msg": "add random hash generator helper",
                "file_path": "src/utils.js",
                "line_no": 41,
                "secret_type": "Random string",
                "severity": "Low",
                "confidence": "Low",
                "entropy_score": 4.35,
                "raw_val": "a3f91048b61c9e830f214d0234c2e1",
                "remediation": REMEDIATION_GUIDES["High entropy string"],
                "offset_minutes": 120
            },
            {
                "repo": "college-chatbot",
                "commit_sha": "771b044",
                "commit_msg": "unit test mock salt",
                "file_path": "tests/mock.py",
                "line_no": 3,
                "secret_type": "Random string",
                "severity": "Low",
                "confidence": "Low",
                "entropy_score": 4.31,
                "raw_val": "7b2d88194420aa912803b90af",
                "remediation": REMEDIATION_GUIDES["High entropy string"],
                "offset_minutes": 180
            }
        ]

        for df in demo_findings:
            r = created_repos.get(df["repo"])
            if not r:
                continue
            masked = mask_secret(df["raw_val"])
            fp = compute_fingerprint(df["repo"], df["file_path"], df["secret_type"], df["raw_val"])
            finding = Finding(
                repo_id=r.id,
                commit_sha=df["commit_sha"],
                commit_message=df["commit_msg"],
                commit_url=f"https://github.com/{df['repo']}/commit/{df['commit_sha']}",
                file_path=df["file_path"],
                line_no=df["line_no"],
                secret_type=df["secret_type"],
                severity=df["severity"],
                confidence=df["confidence"],
                entropy_score=df["entropy_score"],
                pattern_matched=df["secret_type"],
                masked_value=masked,
                fingerprint=fp,
                status="open",
                detected_at=now - timedelta(minutes=df["offset_minutes"]),
                alerted_at=now - timedelta(minutes=df["offset_minutes"]),
                remediation=df["remediation"]
            )
            db.add(finding)

        db.commit()
        logger.info("Demo data successfully populated!")
    except Exception as e:
        logger.error(f"Error seeding demo data: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    Base.metadata.create_all(bind=engine)
    seed_demo_data()

    # Start poller task in background
    poller_task = asyncio.create_task(run_poller_daemon())
    yield
    poller_task.cancel()

app = FastAPI(
    title="SecretWatch API",
    description="Real-time detection of hardcoded API keys and tokens in public student repositories",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repos.router)
app.include_router(findings.router)
app.include_router(stats.router)
app.include_router(webhook.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "SecretWatch Sentinel", "version": "1.0.0"}
