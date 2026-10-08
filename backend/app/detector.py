import re
import math
import hashlib
from typing import List, Dict, Any, Optional
from .config import settings

class RegexRule:
    def __init__(self, name: str, pattern: str, severity: str, default_confidence: str = "High", remediation: str = ""):
        self.name = name
        self.regex = re.compile(pattern)
        self.severity = severity
        self.default_confidence = default_confidence
        self.remediation = remediation

# Provider-specific remediation templates
REMEDIATION_GUIDES = {
    "AWS key": (
        "1. Revoke this key in the AWS IAM Console immediately.\n"
        "2. Generate a new IAM access key and store it in a .env file.\n"
        "3. Add .env to .gitignore.\n"
        "4. Review AWS CloudTrail & billing logs for unauthorized EC2/resource provisioning.\n"
        "5. Deleting the line is not enough; Git keeps history. Revocation is mandatory."
    ),
    "OpenAI key": (
        "1. Revoke this API key in your OpenAI platform dashboard right away.\n"
        "2. Create a new secret key and store it in environment variables.\n"
        "3. Add .env to .gitignore.\n"
        "4. Check usage logs and credit limits for unexpected requests.\n"
        "5. Deleting the line in a new commit does not remove past commits."
    ),
    "GitHub token": (
        "1. Revoke or delete this Personal Access Token immediately in GitHub Settings > Developer Settings.\n"
        "2. Generate a fine-grained token with minimum required permissions.\n"
        "3. Add .env to .gitignore.\n"
        "4. Check your account audit log for unauthorized repository actions."
    ),
    "Stripe secret key": (
        "1. Roll this key immediately in Stripe Dashboard > Developers > API keys.\n"
        "2. Check payment logs and webhook events for unauthorized charges.\n"
        "3. Store new keys strictly in server environment variables.\n"
        "4. Ensure your repository .gitignore includes .env."
    ),
    "Private key": (
        "1. This private key is compromised. Delete the corresponding public key from servers/authorized_keys.\n"
        "2. Generate a new SSH/RSA key pair (`ssh-keygen -t ed25519`).\n"
        "3. Never commit PEM or KEY files; reference file paths via environment variables."
    ),
    "Google API key": (
        "1. Restrict or regenerate this key in Google Cloud Console > Credentials.\n"
        "2. Apply API restrictions (e.g. limit to Maps SDK or Vision API) and IP/HTTP referrers.\n"
        "3. Move the key to .env and gitignore it."
    ),
    "Slack token": (
        "1. Invalidate this token in your Slack App Management console.\n"
        "2. Regenerate credentials and verify app bot permissions.\n"
        "3. Store the token securely in your deployment environment."
    ),
    "Discord webhook URL": (
        "1. Open Discord Server Settings > Integrations > Webhooks and delete this webhook.\n"
        "2. Create a new webhook URL and keep it in your server .env file.\n"
        "3. Never embed webhook URLs directly in client-side code."
    ),
    "Database URL": (
        "1. Immediately change the database password in your cloud database provider or pg_hba.\n"
        "2. Terminate all active database connections if suspicious activity is noticed.\n"
        "3. Store database connection strings in environment variables (e.g., DATABASE_URL)."
    ),
    "JWT": (
        "1. Inspect the JWT payload (claims/expiry).\n"
        "2. If this is a long-lived user/service token, revoke the signing key or invalidate the session.\n"
        "3. Store authentication tokens in secure session cookies or runtime memory only."
    ),
    "High entropy string": (
        "1. Investigate whether this string is a production API secret or credential.\n"
        "2. If valid, revoke and rotate the secret immediately.\n"
        "3. Add .env to .gitignore and move the credential out of source code."
    ),
    "Generic secret": (
        "1. Revoke or rotate this credential immediately.\n"
        "2. Store secrets in .env and verify .gitignore.\n"
        "3. Check for any unauthorized access in your service audit logs."
    )
}

REGEX_RULES = [
    RegexRule(
        name="AWS key",
        pattern=r"\b(AKIA[0-9A-Z]{16})\b",
        severity="Critical",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["AWS key"]
    ),
    RegexRule(
        name="GitHub token",
        pattern=r"\b(ghp_[A-Za-z0-9]{36})\b",
        severity="Critical",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["GitHub token"]
    ),
    RegexRule(
        name="GitHub token",
        pattern=r"\b(github_pat_[A-Za-z0-9_]{50,80})\b",
        severity="Critical",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["GitHub token"]
    ),
    RegexRule(
        name="Stripe secret key",
        pattern=r"\b(sk_live_[0-9A-Za-z]{24,})\b",
        severity="Critical",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["Stripe secret key"]
    ),
    RegexRule(
        name="Private key",
        pattern=r"(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)",
        severity="Critical",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["Private key"]
    ),
    RegexRule(
        name="OpenAI key",
        pattern=r"\b(sk-[A-Za-z0-9_\-]{20,64})\b",
        severity="High",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["OpenAI key"]
    ),
    RegexRule(
        name="Google API key",
        pattern=r"\b(AIza[0-9A-Za-z_\-]{35})\b",
        severity="High",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["Google API key"]
    ),
    RegexRule(
        name="Slack token",
        pattern=r"\b(xox[baprs]-[0-9A-Za-z\-]{10,48})\b",
        severity="High",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["Slack token"]
    ),
    RegexRule(
        name="Discord webhook URL",
        pattern=r"(https://discord(?:app)?\.com/api/webhooks/[0-9]+/[\w\-]+)",
        severity="Medium",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["Discord webhook URL"]
    ),
    RegexRule(
        name="Database URL",
        pattern=r"((?:postgres|postgresql|mysql|mongodb)(?:\+srv)?://[^\s:@]+:[^\s:@]+@[^\s/]+/[^\s]+)",
        severity="High",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["Database URL"]
    ),
    RegexRule(
        name="JWT",
        pattern=r"\b(eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})\b",
        severity="Medium",
        default_confidence="High",
        remediation=REMEDIATION_GUIDES["JWT"]
    )
]

# Sensitive and non-sensitive contextual variable names
SENSITIVE_HINTS = {"api_key", "apikey", "secret", "token", "password", "passwd", "auth", "credential", "private_key", "client_secret", "access_key"}
BENIGN_HINTS = {"hash", "checksum", "uuid", "sha", "id", "version", "commit", "nonce"}

# Generic assignment regex for candidates
GENERIC_ASSIGNMENT_REGEX = re.compile(
    r"""(?i)(?P<varname>[a-z0-9_\-\.]+)\s*[:=]\s*["'](?P<val>[A-Za-z0-9_\-+/=]{16,128})["']"""
)

UUID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

def calculate_shannon_entropy(data: str) -> float:
    """Calculates Shannon entropy in bits per character."""
    if not data:
        return 0.0
    length = len(data)
    frequencies = {}
    for char in data:
        frequencies[char] = frequencies.get(char, 0) + 1
    entropy = 0.0
    for count in frequencies.values():
        p_x = count / length
        entropy += - p_x * math.log2(p_x)
    return round(entropy, 3)

# Obvious placeholder detection
PLACEHOLDER_WORDS = {
    "example", "dummy", "changeme", "your_key", "your_api_key", "your-api-key",
    "replace_me", "placeholder", "insert_here", "my_secret", "dummy_token", "fake_key", "xxx"
}

def is_placeholder(token: str) -> bool:
    token_lower = token.lower().strip()
    
    # Direct match or clear prefix/suffix indicator
    if token_lower in PLACEHOLDER_WORDS:
        return True
    
    # Specific placeholder phrases
    for phrase in ["your_api_key", "your-api-key", "replace_me", "insert_here", "dummy_key", "fake_key"]:
        if phrase in token_lower:
            return True
            
    # For URLs, don't reject just because host is example.com, unless credentials themselves are dummy
    if "://" in token_lower:
        if "user:pass" in token_lower or "admin:admin" in token_lower or "user:password" in token_lower:
            return True
        return False
        
    # Check if string consists almost entirely of 1 or 2 repeated chars
    unique_chars = set(token)
    if len(unique_chars) <= 2 and len(token) > 6:
        return True
        
    # Check if dummy sequences like 123456789
    if token in ("123456789", "1234567890", "abcdefgh", "0123456789"):
        return True
        
    # Check if standard UUID
    if UUID_REGEX.match(token):
        return True
        
    return False

def mask_secret(secret: str) -> str:
    """Masks secret keeping short prefix and suffix. Raw secret is NEVER stored."""
    if len(secret) <= 8:
        return "****"
    if secret.startswith("https://discord"):
        return "discord.com/api/web****"
    if "://" in secret and "@" in secret:
        # DB URL: postgres://admin:****@host/db
        try:
            proto, rest = secret.split("://", 1)
            creds, host = rest.split("@", 1)
            user = creds.split(":", 1)[0]
            return f"{proto}://{user}:****@{host.split('/')[0]}"
        except Exception:
            return secret[:10] + "************" + secret[-4:]

    prefix = secret[:4]
    suffix = secret[-4:]
    return f"{prefix}************{suffix}"

def compute_fingerprint(repo_full_name: str, file_path: str, secret_type: str, raw_secret: str) -> str:
    """Computes irreversible salted SHA-256 fingerprint for deduplication."""
    payload = f"{settings.SALT_SECRET}:{repo_full_name}:{file_path}:{secret_type}:{raw_secret}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def should_skip_file(file_path: str) -> bool:
    """Filters out lockfiles, binaries, fixtures, documentation from high-noise detections."""
    fp = file_path.lower()
    skip_extensions = [
        ".md", ".txt", ".rst", ".lock", ".svg", ".png", ".jpg", ".jpeg",
        ".min.js", ".min.css", ".map", ".ico", ".woff", ".woff2", ".ttf"
    ]
    skip_filenames = ["package-lock.json", "yarn.lock", "poetry.lock", "cargo.lock", "pnpm-lock.yaml"]
    
    if any(fp.endswith(ext) for ext in skip_extensions):
        return True
    if any(fp.endswith(fn) for fn in skip_filenames):
        return True
    return False

def scan_text_line(line: str, line_no: int, repo_full_name: str, file_path: str) -> List[Dict[str, Any]]:
    """
    Executes Stage 1 (Regex) and Stage 2 (Entropy + Context) on an added line of code.
    Returns safe finding dicts (raw secret is never exposed).
    """
    findings = []
    reported_spans = []

    # Stage 1: Provider-Specific Regex
    for rule in REGEX_RULES:
        for match in rule.regex.finditer(line):
            raw_val = match.group(1)
            span = match.span(1)

            if is_placeholder(raw_val):
                continue

            reported_spans.append(span)
            entropy = calculate_shannon_entropy(raw_val)
            masked = mask_secret(raw_val)
            fp = compute_fingerprint(repo_full_name, file_path, rule.name, raw_val)

            findings.append({
                "line_no": line_no,
                "secret_type": rule.name,
                "severity": rule.severity,
                "confidence": rule.default_confidence,
                "entropy_score": entropy,
                "pattern_matched": rule.name,
                "masked_value": masked,
                "fingerprint": fp,
                "remediation": rule.remediation
            })

    # Stage 2: Generic Variable Assignment + Shannon Entropy
    for match in GENERIC_ASSIGNMENT_REGEX.finditer(line):
        varname = match.group("varname").lower()
        candidate = match.group("val")
        span = match.span("val")

        # Skip if already captured by stage 1
        if any(s[0] <= span[0] and s[1] >= span[1] for s in reported_spans):
            continue

        if is_placeholder(candidate):
            continue

        entropy = calculate_shannon_entropy(candidate)

        # Context heuristics
        has_sensitive_hint = any(h in varname for h in SENSITIVE_HINTS)
        has_benign_hint = any(b in varname for b in BENIGN_HINTS)

        if has_benign_hint:
            continue

        # Entropy thresholds: Base64 ~4.2+, Hex ~3.0+
        is_high_entropy = entropy >= 4.2 or (len(candidate) >= 32 and entropy >= 3.2)

        if has_sensitive_hint and is_high_entropy:
            severity = "High"
            confidence = "High"
            secret_type = "Generic secret"
        elif has_sensitive_hint:
            severity = "Medium"
            confidence = "Medium"
            secret_type = "Generic secret"
        elif is_high_entropy:
            severity = "Low"
            confidence = "Low"
            secret_type = "Random string"
        else:
            continue

        masked = mask_secret(candidate)
        fp = compute_fingerprint(repo_full_name, file_path, secret_type, candidate)

        findings.append({
            "line_no": line_no,
            "secret_type": secret_type,
            "severity": severity,
            "confidence": confidence,
            "entropy_score": entropy,
            "pattern_matched": f"entropy({entropy}) + var({varname})",
            "masked_value": masked,
            "fingerprint": fp,
            "remediation": REMEDIATION_GUIDES.get(secret_type, REMEDIATION_GUIDES["High entropy string"])
        })

    return findings

def scan_patch(patch_text: str, repo_full_name: str, file_path: str) -> List[Dict[str, Any]]:
    """
    Scans only newly added lines (prefixed with '+') in a git diff/patch.
    """
    if should_skip_file(file_path):
        return []

    findings = []
    current_line_no = 0

    for raw_line in patch_text.splitlines():
        # Git diff hunk header: @@ -1,5 +1,12 @@
        if raw_line.startswith("@@"):
            hunk_match = re.search(r"\+(\d+)", raw_line)
            if hunk_match:
                current_line_no = int(hunk_match.group(1)) - 1
            continue

        if raw_line.startswith("+") and not raw_line.startswith("+++"):
            current_line_no += 1
            line_content = raw_line[1:]  # remove the '+' marker
            line_findings = scan_text_line(line_content, current_line_no, repo_full_name, file_path)
            findings.extend(line_findings)
        elif not raw_line.startswith("-"):
            current_line_no += 1

    return findings
