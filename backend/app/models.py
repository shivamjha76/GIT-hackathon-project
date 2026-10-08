from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)
    owner = Column(String(100), nullable=False)
    name = Column(String(100), nullable=False)
    full_name = Column(String(200), unique=True, index=True, nullable=False)
    description = Column(String(255), default="")
    added_by = Column(String(100), default="student")
    interval_seconds = Column(Integer, default=15)
    last_seen_sha = Column(String(64), nullable=True)
    etag = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    status = Column(String(50), default="Idle")  # Idle, Scanning, Error
    error_message = Column(Text, nullable=True)
    last_scanned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    findings = relationship("Finding", back_populates="repository", cascade="all, delete-orphan")
    scan_runs = relationship("ScanRun", back_populates="repository", cascade="all, delete-orphan")

class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False, index=True)
    commit_sha = Column(String(64), nullable=False)
    commit_message = Column(String(255), nullable=True)
    commit_url = Column(String(255), nullable=True)
    file_path = Column(String(255), nullable=False)
    line_no = Column(Integer, nullable=False)
    secret_type = Column(String(100), nullable=False)  # AWS key, OpenAI key, etc.
    severity = Column(String(20), nullable=False, index=True)  # Critical, High, Medium, Low
    confidence = Column(String(20), default="High")  # High, Medium, Low
    entropy_score = Column(Float, default=0.0)
    pattern_matched = Column(String(100), nullable=True)
    masked_value = Column(String(255), nullable=False)
    fingerprint = Column(String(64), nullable=False, index=True)
    status = Column(String(30), default="open", index=True)  # open, resolved, false_positive
    detected_at = Column(DateTime, default=utc_now, index=True)
    alerted_at = Column(DateTime, nullable=True)
    remediation = Column(Text, nullable=True)

    repository = relationship("Repository", back_populates="findings")

class ScanRun(Base):
    __tablename__ = "scan_runs"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    started_at = Column(DateTime, default=utc_now)
    finished_at = Column(DateTime, nullable=True)
    commits_scanned = Column(Integer, default=0)
    findings_count = Column(Integer, default=0)
    error = Column(Text, nullable=True)

    repository = relationship("Repository", back_populates="scan_runs")

class Allowlist(Base):
    __tablename__ = "allowlist"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=True)
    pattern_or_path = Column(String(255), nullable=False)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now)
