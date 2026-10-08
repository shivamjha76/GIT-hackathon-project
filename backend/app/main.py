import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .poller import run_poller_daemon
from .routers import repos, findings, stats, webhook

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("secretwatch")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    Base.metadata.create_all(bind=engine)

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
