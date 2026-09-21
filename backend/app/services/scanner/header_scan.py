"""
HTTP security header analysis.

Passive check: makes one standard HTTPS GET request to the verified
hostname (identical to what a browser does when loading the page) and
inspects the response headers against the OWASP Secure Headers baseline.

Only call this with hostnames belonging to verified Assets.

Requires: pip install requests
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any
import requests


@dataclass
class HeaderFinding:
    category: str = "headers"
    severity: str = "medium"
    title: str = ""
    detail: dict[str, Any] = field(default_factory=dict)


# Baseline expected headers and why they matter.
EXPECTED_HEADERS = {
    "Strict-Transport-Security": ("high", "Missing HSTS header — site does not enforce HTTPS-only connections"),
    "X-Content-Type-Options": ("medium", "Missing X-Content-Type-Options — browser may MIME-sniff responses"),
    "X-Frame-Options": ("medium", "Missing X-Frame-Options — page may be vulnerable to clickjacking"),
    "Content-Security-Policy": ("high", "Missing Content-Security-Policy — reduced protection against XSS/injection"),
    "Referrer-Policy": ("low", "Missing Referrer-Policy — full URL may leak to third parties via referrer header"),
    "Permissions-Policy": ("low", "Missing Permissions-Policy — browser features not explicitly restricted"),
}


from app.core.retry import retry_transient


@retry_transient(max_attempts=3, backoff_delays=(1, 2, 4))
def run_header_scan(url: str, timeout: int = 10) -> list[HeaderFinding]:
    findings: list[HeaderFinding] = []

    if not url.startswith("http"):
        url = f"https://{url}"

    resp = requests.get(url, timeout=timeout, allow_redirects=True)
    headers = {k: v for k, v in resp.headers.items()}

    for header_name, (severity, message) in EXPECTED_HEADERS.items():
        if header_name not in headers:
            findings.append(HeaderFinding(
                severity=severity,
                title=message,
                detail={"missing_header": header_name, "status_code": resp.status_code},
            ))

    # Cookie flags
    for cookie in resp.cookies:
        issues = []
        if not cookie.secure:
            issues.append("missing Secure flag")
        if not cookie.has_nonstandard_attr("HttpOnly"):
            issues.append("missing HttpOnly flag")
        if issues:
            findings.append(HeaderFinding(
                severity="medium",
                title=f"Cookie '{cookie.name}' has insecure attributes",
                detail={"cookie": cookie.name, "issues": issues},
            ))

    if not findings:
        findings.append(HeaderFinding(
            severity="info",
            title="All baseline security headers present",
        ))

    return findings
