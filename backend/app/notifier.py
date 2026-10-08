import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from .config import settings

logger = logging.getLogger(__name__)

SEVERITY_COLORS = {
    "Critical": 0xEF4444,  # Red (#ef4444)
    "High": 0xF97316,      # Orange (#f97316)
    "Medium": 0xEAB308,    # Yellow (#eab308)
    "Low": 0x64748B        # Slate Gray (#64748b)
}

async def send_discord_alert(finding: Dict[str, Any], repo_name: str, commit_sha: str, commit_url: Optional[str] = None) -> bool:
    """
    Sends rich color-coded embed alert to Discord webhook.
    Never exposes raw secrets; only masked values and safe metadata.
    """
    webhook_url = settings.DISCORD_WEBHOOK_URL
    if not webhook_url:
        logger.info("Discord alert skipped: DISCORD_WEBHOOK_URL not configured")
        return False

    short_sha = commit_sha[:7] if commit_sha else "unknown"
    commit_link = commit_url or f"https://github.com/{repo_name}/commit/{commit_sha}"
    severity = finding.get("severity", "Medium")
    color = SEVERITY_COLORS.get(severity, 0xEAB308)
    secret_type = finding.get("secret_type", "Secret")
    masked_val = finding.get("masked_value", "****")
    file_path = finding.get("file_path", "unknown")
    line_no = finding.get("line_no", 1)
    remediation = finding.get("remediation", "Revoke credentials immediately.")

    embed = {
        "title": f"🚨 {severity.upper()} SECRET LEAK DETECTED",
        "description": f"A exposed **{secret_type}** was detected in repository **[{repo_name}](https://github.com/{repo_name})**.",
        "color": color,
        "fields": [
            {
                "name": "📁 File & Location",
                "value": f"`{file_path}:{line_no}`",
                "inline": True
            },
            {
                "name": "🔑 Detected Key (Masked)",
                "value": f"`{masked_val}`",
                "inline": True
            },
            {
                "name": "🔀 Commit",
                "value": f"[{short_sha}]({commit_link})",
                "inline": True
            },
            {
                "name": "🛠️ What to do now (Remediation)",
                "value": remediation,
                "inline": False
            }
        ],
        "footer": {
            "text": "SecretWatch • Student Repository Protection • GIT Jaipur Codefiesta"
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    payload = {
        "username": "SecretWatch Sentinel",
        "avatar_url": "https://raw.githubusercontent.com/feathericons/feather/master/icons/shield.svg",
        "embeds": [embed]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code in (200, 204):
                logger.info(f"Discord alert successfully sent for {repo_name} ({secret_type})")
                return True
            else:
                logger.error(f"Failed to send Discord alert: HTTP {resp.status_code} - {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Discord alert exception: {str(e)}")
        return False

async def send_slack_alert(finding: Dict[str, Any], repo_name: str, commit_sha: str, commit_url: Optional[str] = None) -> bool:
    """Sends Slack incoming webhook notification."""
    webhook_url = settings.SLACK_WEBHOOK_URL
    if not webhook_url:
        return False

    short_sha = commit_sha[:7] if commit_sha else "unknown"
    commit_link = commit_url or f"https://github.com/{repo_name}/commit/{commit_sha}"
    severity = finding.get("severity", "Medium")
    secret_type = finding.get("secret_type", "Secret")
    masked_val = finding.get("masked_value", "****")
    file_path = finding.get("file_path", "unknown")
    line_no = finding.get("line_no", 1)

    text = (
        f":warning: *[{severity.upper()}] Secret Leak Detected in <https://github.com/{repo_name}|{repo_name}>*\n"
        f"• *Type:* {secret_type}\n"
        f"• *File:* `{file_path}:{line_no}`\n"
        f"• *Masked Value:* `{masked_val}`\n"
        f"• *Commit:* <{commit_link}|{short_sha}>\n"
        f"• *Action:* Revoke/rotate the credential immediately and remove from Git history."
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json={"text": text})
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Slack alert exception: {str(e)}")
        return False

async def dispatch_alert(finding: Dict[str, Any], repo_name: str, commit_sha: str, commit_url: Optional[str] = None) -> bool:
    """Dispatches finding alert to Discord and/or Slack."""
    discord_ok = await send_discord_alert(finding, repo_name, commit_sha, commit_url)
    slack_ok = await send_slack_alert(finding, repo_name, commit_sha, commit_url)
    return discord_ok or slack_ok
