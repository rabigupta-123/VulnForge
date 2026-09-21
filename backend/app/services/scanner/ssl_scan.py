"""
SSL/TLS analysis module.

IMPORTANT: This must only ever be called with `hostname` values belonging
to an Asset record whose verification_status == 'verified' in the database.
Enforce that check in the calling service/worker layer, not here — this
module intentionally does not know about your DB, so it can't be relied on
as the sole safeguard. Wire the check in wherever this function is called.

Requires: pip install sslyze
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

try:
    from sslyze import (
        ServerNetworkLocation,
        ServerScanRequest,
        Scanner,
        ScanCommand,
    )
    HAS_SSLYZE = True
except ImportError:
    HAS_SSLYZE = False


@dataclass
class SSLFinding:
    category: str = "ssl"
    severity: str = "info"
    title: str = ""
    detail: dict[str, Any] = field(default_factory=dict)


from app.core.retry import retry_transient


@retry_transient(max_attempts=3, backoff_delays=(1, 2, 4))
def run_ssl_scan(hostname: str, port: int = 443) -> list[SSLFinding]:
    """
    Runs a real SSLyze scan against `hostname` and returns structured
    findings ready to store in the `findings` table (raw_output=detail).

    This performs a standard TLS handshake / protocol negotiation with the
    target — the same kind of connection any browser makes — it does not
    attempt to exploit anything.
    """
    findings: list[SSLFinding] = []

    if not HAS_SSLYZE:
        return []
    scanner = Scanner()
    scanner.queue_scan(
        ServerScanRequest(
            server_location=server_location,
            scan_commands={
                ScanCommand.CERTIFICATE_INFO,
                ScanCommand.SSL_2_0_CIPHER_SUITES,
                ScanCommand.SSL_3_0_CIPHER_SUITES,
                ScanCommand.TLS_1_0_CIPHER_SUITES,
                ScanCommand.TLS_1_1_CIPHER_SUITES,
                ScanCommand.TLS_1_2_CIPHER_SUITES,
                ScanCommand.TLS_1_3_CIPHER_SUITES,
                ScanCommand.HEARTBLEED,
                ScanCommand.ROBOT,
            },
        )
    )

    for result in scanner.get_results():
        cmd_results = result.scan_result

        # Flag legacy/insecure protocols still being accepted
        for attr, label in [
            ("ssl_2_0_cipher_suites", "SSLv2"),
            ("ssl_3_0_cipher_suites", "SSLv3"),
            ("tls_1_0_cipher_suites", "TLS 1.0"),
            ("tls_1_1_cipher_suites", "TLS 1.1"),
        ]:
            cmd_result = getattr(cmd_results, attr, None)
            if cmd_result and cmd_result.result and cmd_result.result.accepted_cipher_suites:
                findings.append(SSLFinding(
                    severity="high",
                    title=f"Server accepts connections over {label} (deprecated/insecure)",
                    detail={
                        "protocol": label,
                        "accepted_ciphers": [
                            c.cipher_suite.name
                            for c in cmd_result.result.accepted_cipher_suites
                        ],
                    },
                ))

        # Heartbleed
        heartbleed = getattr(cmd_results, "heartbleed", None)
        if heartbleed and heartbleed.result and heartbleed.result.is_vulnerable_to_heartbleed:
            findings.append(SSLFinding(
                severity="critical",
                title="Server is vulnerable to Heartbleed (CVE-2014-0160)",
                detail={"cve": "CVE-2014-0160"},
            ))

        # ROBOT
        robot = getattr(cmd_results, "robot", None)
        if robot and robot.result and str(robot.result.robot_result) != "NOT_VULNERABLE":
            findings.append(SSLFinding(
                severity="high",
                title="Server is potentially vulnerable to ROBOT attack",
                detail={"robot_result": str(robot.result.robot_result)},
            ))

        # Certificate details (expiry, issuer, etc.)
        cert_info = getattr(cmd_results, "certificate_info", None)
        if cert_info and cert_info.result:
            for deployment in cert_info.result.certificate_deployments:
                leaf = deployment.received_certificate_chain[0]
                findings.append(SSLFinding(
                    severity="info",
                    title="Certificate details",
                    detail={
                        "subject": str(leaf.subject),
                        "not_valid_after": leaf.not_valid_after.isoformat(),
                        "issuer": str(leaf.issuer),
                    },
                ))

    if not findings:
        findings.append(SSLFinding(
            severity="info",
            title="No SSL/TLS issues detected by automated checks",
        ))

    return findings
