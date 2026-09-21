"""
Port/service discovery via Nmap.

CRITICAL: only ever call this against the resolved IP of a VERIFIED asset,
and only after the calling service has confirmed asset.verification_status
== 'verified'. Run this inside the isolated scan-worker container with
egress restricted to that single IP — do not rely on this module alone
to constrain what gets scanned.

This uses a conservative, well-known port list rather than a full 1-65535
sweep, both to keep scans fast and to stay clearly within "service
discovery" rather than aggressive probing.

Requires: nmap installed on the system (apt install nmap) + pip install python-nmap
"""

from __future__ import annotations
from dataclasses import dataclass, field
try:
    import nmap
    HAS_NMAP = True
except ImportError:
    HAS_NMAP = False

# Common ports worth checking for a web-facing asset. Extend deliberately,
# not by default — every added port is more active probing.
DEFAULT_PORTS = "21,22,23,25,53,80,110,143,443,465,587,993,995,3306,3389,5432,6379,8080,8443"

RISKY_OPEN_PORTS = {
    "21": ("medium", "FTP open — often unencrypted, consider disabling or restricting"),
    "23": ("high", "Telnet open — unencrypted remote access, should not be internet-facing"),
    "3306": ("high", "MySQL port open to the internet — database should not be publicly reachable"),
    "5432": ("high", "PostgreSQL port open to the internet — database should not be publicly reachable"),
    "3389": ("high", "RDP open to the internet — high-value target for brute force, restrict access"),
    "6379": ("high", "Redis port open to the internet — commonly unauthenticated, restrict access"),
}


@dataclass
class PortFinding:
    category: str = "ports"
    severity: str = "info"
    title: str = ""
    detail: dict[str, Any] = field(default_factory=dict)


from app.core.retry import retry_transient


@retry_transient(max_attempts=3, backoff_delays=(1, 2, 4))
def run_port_scan(target_ip: str, ports: str = DEFAULT_PORTS) -> list[PortFinding]:
    findings: list[PortFinding] = []

    if not HAS_NMAP:
        return []
    # -sT: TCP connect scan (no raw sockets needed, no special privileges)
    # -Pn: skip host-discovery ping (some hosts block ICMP)
    scanner.scan(target_ip, ports, arguments="-sT -Pn --host-timeout 60s")

    if target_ip not in scanner.all_hosts():
        findings.append(PortFinding(
            severity="info",
            title="Host did not respond to scan (may be filtering/blocking probes)",
        ))
        return findings

    host_data = scanner[target_ip]
    for proto in host_data.all_protocols():
        for port, port_data in host_data[proto].items():
            if port_data["state"] != "open":
                continue
            port_str = str(port)
            service = port_data.get("name", "unknown")

            if port_str in RISKY_OPEN_PORTS:
                severity, message = RISKY_OPEN_PORTS[port_str]
                findings.append(PortFinding(
                    severity=severity,
                    title=message,
                    detail={"port": port, "service": service},
                ))
            else:
                findings.append(PortFinding(
                    severity="info",
                    title=f"Open port {port}/{proto} ({service})",
                    detail={"port": port, "service": service},
                ))

    if not findings:
        findings.append(PortFinding(
            severity="info",
            title="No open ports detected in scanned range",
        ))

    return findings
