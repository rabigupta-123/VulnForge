import json
import socket
import ssl
import time

FINDING_EXPIRED_CERT = {
    "title": "Expired SSL/TLS Certificate",
    "category": "ssl",
    "severity": "critical",
    "cvss_score": 9.8,
    "owasp_mapping": "A02:2021-Cryptographic Failures",
    "description": (
        "The SSL/TLS certificate for this domain has expired. "
        "Browsers will display severe warning screens to all visitors, blocking access, "
        "and traffic between clients and the server is no longer trustworthily encrypted."
    ),
    "remediation": (
        "Renew the SSL/TLS certificate immediately via your registrar, certificate authority, "
        "or automate it using Let's Encrypt."
    ),
}

FINDING_EXPIRING_SOON_CERT = {
    "title": "SSL/TLS Certificate Expiring Soon",
    "category": "ssl",
    "severity": "medium",
    "cvss_score": 6.5,
    "owasp_mapping": "A02:2021-Cryptographic Failures",
    "description": (
        "The SSL/TLS certificate for this domain will expire in less than 14 days. "
        "Once expired, clients will face blocking security warnings when trying to load your page."
    ),
    "remediation": (
        "Configure automated renewal hooks or trigger a manual certificate renewal soon "
        "to prevent downtime."
    ),
}

FINDING_INVALID_CERT = {
    "title": "Invalid SSL/TLS Certificate Verification",
    "category": "ssl",
    "severity": "high",
    "cvss_score": 7.5,
    "owasp_mapping": "A02:2021-Cryptographic Failures",
    "description": (
        "The SSL/TLS certificate verification failed. This can indicate a self-signed certificate, "
        "a mismatch between the domain name and the certificate name, or an untrusted certificate chain."
    ),
    "remediation": (
        "Ensure you are using a certificate issued by a trusted root Certificate Authority (CA) "
        "matching your domain name."
    ),
}


def scan_ssl(domain: str) -> list:
    """
    Perform passive SSL/TLS certificate scan on port 443.
    """
    findings = []
    context = ssl.create_default_context()
    # Disable certificate hostname matching when capturing general handshake failures
    # to differentiate between expired certs and parsing issues

    try:
        # Socket timeout 3.0 seconds
        with socket.create_connection((domain, 443), timeout=3.0) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                if not cert:
                    return findings

                not_after_str = cert.get("notAfter")
                if not_after_str:
                    epoch_seconds = ssl.cert_time_to_seconds(not_after_str)
                    now_epoch = time.time()
                    seconds_left = epoch_seconds - now_epoch

                    if seconds_left < 0:
                        f = FINDING_EXPIRED_CERT.copy()
                        f["raw_output"] = json.dumps({"expiry": not_after_str, "seconds_left": seconds_left})
                        findings.append(f)
                    elif seconds_left < 14 * 24 * 3600:  # 14 days
                        f = FINDING_EXPIRING_SOON_CERT.copy()
                        f["raw_output"] = json.dumps(
                            {"expiry": not_after_str, "days_left": round(seconds_left / 86400, 1)}
                        )
                        findings.append(f)

    except ssl.SSLCertVerificationError as e:
        f = FINDING_INVALID_CERT.copy()
        f["raw_output"] = json.dumps({"error_message": str(e), "code": "CERT_VERIFICATION_FAILED"})
        findings.append(f)
    except Exception:
        # If port 443 is closed or connection times out, we skip SSL findings
        # rather than registering a connection issue (e.g. target doesn't run HTTPS yet)
        pass

    return findings
