import concurrent.futures
import json
import socket

# Port definitions and finding template blueprints
PORTS_TO_SCAN = [21, 22, 23, 25, 53, 80, 110, 143, 443, 3306, 3389, 5432, 8080]

FINDING_UNENCRYPTED_PORT = {
    "title": "Exposed Insecure/Unencrypted Service Port",
    "category": "ports",
    "severity": "high",
    "cvss_score": 7.5,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "An insecure, unencrypted protocol port (like FTP on 21 or Telnet on 23) was found open. "
        "These protocols transmit credentials and data in plain text, making them vulnerable "
        "to sniffing and hijacking."
    ),
    "remediation": (
        "Disable the insecure service, or restrict access using a firewall. "
        "Migrate to secure encrypted equivalents (e.g. use SFTP/SSH on port 22 instead of FTP/Telnet)."
    ),
}

FINDING_MANAGEMENT_PORT = {
    "title": "Exposed Management Interface Port",
    "category": "ports",
    "severity": "medium",
    "cvss_score": 5.3,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "An administrative management port (like SSH on 22 or RDP on 3389) is open to the public internet. "
        "Exposing management interfaces increases the attack surface to brute-force credential stuffing "
        "and zero-day remote execution exploits."
    ),
    "remediation": (
        "Close the port to the public. Restrict management access behind a virtual private network (VPN) "
        "or restrict inbound access to trusted management IP addresses only."
    ),
}

FINDING_DATABASE_PORT = {
    "title": "Exposed Database Service Port",
    "category": "ports",
    "severity": "high",
    "cvss_score": 7.5,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "A database listener port (like MySQL on 3306 or PostgreSQL on 5432) was found open to the public. "
        "Direct database exposure bypasses application application layers and invites SQL injections, "
        "brute-force attacks, and direct exploits."
    ),
    "remediation": (
        "Block public access to your database port using firewall rules (iptables, security groups). "
        "Only allow localhost connections or trust-specific server IP addresses."
    ),
}

FINDING_GENERAL_PORT = {
    "title": "Exposed Server Port",
    "category": "ports",
    "severity": "info",
    "cvss_score": 0.0,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "A general port (like HTTP/HTTPS or alt web server) was found open during active scan."
    ),
    "remediation": (
        "Ensure only necessary web ports are open to the public."
    ),
}


def test_port(domain: str, port: int) -> tuple:
    """
    Attempt to connect to a TCP port with a short timeout.
    Returns (port, True) if open, (port, False) if closed.
    """
    try:
        # Resolve target domain and try connection with 1.0 second timeout
        with socket.create_connection((domain, port), timeout=1.0):
            return port, True
    except Exception:
        return port, False


def scan_ports(domain: str) -> list:
    """
    Scan target domain for critical open ports in parallel.
    """
    findings = []
    open_ports = []

    # Scan ports concurrently (using up to 13 threads)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(PORTS_TO_SCAN)) as executor:
        futures = [executor.submit(test_port, domain, port) for port in PORTS_TO_SCAN]
        for future in concurrent.futures.as_completed(futures):
            port, is_open = future.result()
            if is_open:
                open_ports.append(port)

    # Map open ports to findings
    for port in open_ports:
        if port in [21, 23]:
            f = FINDING_UNENCRYPTED_PORT.copy()
            f["title"] = f"Exposed Insecure Service Port (Port {port})"
            f["raw_output"] = json.dumps({"port": port, "status": "open", "type": "insecure"})
            findings.append(f)
        elif port in [22, 3389]:
            f = FINDING_MANAGEMENT_PORT.copy()
            f["title"] = f"Exposed Management Interface Port (Port {port})"
            f["raw_output"] = json.dumps({"port": port, "status": "open", "type": "management"})
            findings.append(f)
        elif port in [3306, 5432]:
            f = FINDING_DATABASE_PORT.copy()
            f["title"] = f"Exposed Database Service Port (Port {port})"
            f["raw_output"] = json.dumps({"port": port, "status": "open", "type": "database"})
            findings.append(f)
        else:
            # DNS, HTTP, HTTPS, alt ports
            f = FINDING_GENERAL_PORT.copy()
            f["title"] = f"Exposed Server Port (Port {port})"
            f["raw_output"] = json.dumps({"port": port, "status": "open", "type": "general"})
            findings.append(f)

    return findings
