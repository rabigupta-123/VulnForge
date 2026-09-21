"""
Domain verification via DNS TXT record.

Flow:
1. User adds a domain -> we generate a random token, store it on the Asset
2. User is shown: "Add a TXT record: cyberguardian-verify=<token> to your DNS"
3. User clicks "Check Now" -> this module queries DNS and compares

Drop into: backend/app/services/verification/dns_verify.py

Requires: pip install dnspython
"""

import secrets
import dns.resolver


def generate_verification_token() -> str:
    """Call this when a user adds a new domain."""
    return f"cyberguardian-verify-{secrets.token_hex(16)}"


def check_dns_txt_verification(domain: str, expected_token: str) -> bool:
    """
    Queries TXT records for `domain` and checks whether any of them
    contain the expected token. Returns True/False — never raises for
    "not found", only for actual DNS resolution errors which are caught
    and treated as "not verified yet" (domain propagation can take time).
    """
    try:
        answers = dns.resolver.resolve(domain, "TXT")
        for rdata in answers:
            txt_value = b"".join(rdata.strings).decode("utf-8", errors="ignore")
            if expected_token in txt_value:
                return True
        return False
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.Timeout):
        return False
