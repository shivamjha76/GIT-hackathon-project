from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Repository, Finding
from ..schemas import StatsResponse
from .findings import format_finding_item

router = APIRouter(prefix="/api/stats", tags=["Stats"])

@router.get("", response_model=StatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_repos = db.query(Repository).count()
    open_findings = db.query(Finding).filter(Finding.status == "open").count()
    critical_findings = db.query(Finding).filter(Finding.status == "open", Finding.severity == "Critical").count()

    # Found today count
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    found_today = db.query(Finding).filter(Finding.detected_at >= today_start).count()

    # Breakdown by severity (for open findings)
    severities = ["Critical", "High", "Medium", "Low"]
    by_severity = {s: 0 for s in severities}
    sev_rows = db.query(Finding.severity, func.count(Finding.id)).filter(Finding.status == "open").group_by(Finding.severity).all()
    for s_name, count in sev_rows:
        if s_name in by_severity:
            by_severity[s_name] = count

    # Findings per day for past 7 days (Mon-Sun)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    days_data = []
    for i in range(6, -1, -1):
        target_day = now - timedelta(days=i)
        d_start = datetime(target_day.year, target_day.month, target_day.day, tzinfo=timezone.utc)
        d_end = d_start + timedelta(days=1)
        cnt = db.query(Finding).filter(Finding.detected_at >= d_start, Finding.detected_at < d_end).count()
        day_str = day_names[target_day.weekday()]
        days_data.append({"day": day_str, "count": cnt})

    # Recent findings
    recent = db.query(Finding).order_by(Finding.id.desc()).limit(10).all()
    recent_formatted = [format_finding_item(f) for f in recent]

    return {
        "total_repositories": total_repos,
        "open_findings": open_findings,
        "critical_findings": critical_findings,
        "found_today": found_today,
        "findings_per_day": days_data,
        "by_severity": by_severity,
        "recent_findings": recent_formatted
    }
