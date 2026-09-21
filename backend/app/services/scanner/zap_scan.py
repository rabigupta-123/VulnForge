"""
OWASP ZAP integration.

Runs against a self-hosted ZAP daemon (started as its own container in
your infra — see docker-compose service `zap`, running
`zap.sh -daemon -host 0.0.0.0 -port 8090 -config api.disablekey=false`).

This module only ever talks to YOUR ZAP instance, which then performs the
scan against the verified target on your behalf — this keeps the actual
scanning logic entirely inside ZAP itself (a mature, widely-used,
purpose-built tool) rather than reimplementing scan logic here.

CRITICAL: only call with `target_url` belonging to a verified Asset, and
run the ZAP container in the same network-isolated worker environment
described in port_scan.py.

Requires: pip install zaproxy (the official ZAP Python API client)
Requires: a running ZAP daemon reachable at zap_api_url
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any
try:
    from zapv2 import ZAPv2
    HAS_ZAP = True
except ImportError:
    HAS_ZAP = False


@dataclass
class ZapFinding:
    category: str = "owasp"
    severity: str = "medium"
    title: str = ""
    detail: dict[str, Any] = field(default_factory=dict)


_RISK_MAP = {
    "High": "high",
    "Medium": "medium",
    "Low": "low",
    "Informational": "info",
}


from app.core.retry import retry_transient


@retry_transient(max_attempts=3, backoff_delays=(1, 2, 4))
def run_zap_scan(
    target_url: str,
    zap_api_url: str = "http://zap:8090",
    api_key: str | None = None,
    max_wait_seconds: int = 600,
    poll_interval: int = 5,
) -> list[ZapFinding]:
    """
    Runs ZAP's spider (passive crawl) followed by an active scan against
    target_url, then pulls structured alerts.
    """
    if not HAS_ZAP:
        return []

    zap = ZAPv2(apikey=api_key, proxies={"http": zap_api_url, "https": zap_api_url})

    findings: list[ZapFinding] = []

    # 1. Spider the target to discover pages/endpoints
    scan_id = zap.spider.scan(target_url)
    waited = 0
    while int(zap.spider.status(scan_id)) < 100 and waited < max_wait_seconds:
        time.sleep(poll_interval)
        waited += poll_interval

    # 2. Active scan (real vulnerability checks — XSS, SQLi patterns, etc.)
    ascan_id = zap.ascan.scan(target_url)
    waited = 0
    while int(zap.ascan.status(ascan_id)) < 100 and waited < max_wait_seconds:
        time.sleep(poll_interval)
        waited += poll_interval

    # 3. Pull structured alerts
    alerts = zap.core.alerts(baseurl=target_url)
    for alert in alerts:
        findings.append(ZapFinding(
            severity=_RISK_MAP.get(alert.get("risk", "Informational"), "info"),
            title=alert.get("alert", "Unnamed finding"),
            detail={
                "url": alert.get("url"),
                "description": alert.get("description"),
                "solution": alert.get("solution"),
                "reference": alert.get("reference"),
                "cweid": alert.get("cweid"),
                "wascid": alert.get("wascid"),
                "confidence": alert.get("confidence"),
            },
        ))

    if not findings:
        findings.append(ZapFinding(
            severity="info",
            title="No issues detected by ZAP active scan",
        ))

    return findings
