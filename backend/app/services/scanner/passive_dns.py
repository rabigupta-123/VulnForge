import json
import dns.resolver

# Define findings mapping for DNS checks
FINDING_MISSING_SPF = {
    "title": "Missing SPF Record",
    "category": "dns",
    "severity": "medium",
    "cvss_score": 4.3,
    "owasp_mapping": "A09:2021-Security Logging and Monitoring Failures",
    "description": (
        "Sender Policy Framework (SPF) record was not found on the domain root. "
        "Without SPF, attackers can spoof emails pretending to come from your domain, "
        "increasing the success rate of phishing campaigns against your users or partners."
    ),
    "remediation": (
        "Add a DNS TXT record at your root domain with a valid SPF policy. "
        "For example, if you use Google Workspace: 'v=spf1 include:_spf.google.com ~all'."
    ),
}

FINDING_MISSING_DMARC = {
    "title": "Missing DMARC Record",
    "category": "dns",
    "severity": "medium",
    "cvss_score": 4.3,
    "owasp_mapping": "A09:2021-Security Logging and Monitoring Failures",
    "description": (
        "DMARC (Domain-based Message Authentication, Reporting, and Conformance) record is missing "
        "at '_dmarc.<domain>'. DMARC dictates how receiving mail servers should handle emails that fail "
        "SPF or DKIM authentication, protecting your brand from impersonation."
    ),
    "remediation": (
        "Publish a DNS TXT record at '_dmarc.<domain>' with a policy rule. "
        "Example: 'v=DMARC1; p=quarantine; rua=mailto:security-reports@<domain>'."
    ),
}


from app.core.retry import retry_transient


@retry_transient(max_attempts=3, backoff_delays=(1, 2, 4))
def scan_dns(domain: str) -> list:
    """
    Perform passive DNS scanning checks (records lookup, SPF check, DMARC check).
    Returns a list of finding dictionaries.
    """
    findings = []
    resolver = dns.resolver.Resolver()
    resolver.timeout = 3.0
    resolver.lifetime = 3.0

    # 1. SPF Check
    has_spf = False
    try:
        answers = resolver.resolve(domain, "TXT")
        for rdata in answers:
            txt_content = "".join([s.decode("utf-8") for s in rdata.strings])
            if txt_content.strip().startswith("v=spf1"):
                has_spf = True
                break
    except Exception:
        pass

    if not has_spf:
        f = FINDING_MISSING_SPF.copy()
        f["raw_output"] = json.dumps({"domain": domain, "check": "SPF", "status": "missing"})
        findings.append(f)

    # 2. DMARC Check
    has_dmarc = False
    dmarc_domain = f"_dmarc.{domain}"
    try:
        answers = resolver.resolve(dmarc_domain, "TXT")
        for rdata in answers:
            txt_content = "".join([s.decode("utf-8") for s in rdata.strings])
            if txt_content.strip().startswith("v=DMARC1"):
                has_dmarc = True
                break
    except Exception:
        pass

    if not has_dmarc:
        f = FINDING_MISSING_DMARC.copy()
        f["raw_output"] = json.dumps({"domain": domain, "check": "DMARC", "status": "missing"})
        findings.append(f)

    return findings
