import json
import re
import requests

FINDING_SERVER_LEAK = {
    "title": "Server Version Disclosure",
    "category": "info_disclosure",
    "severity": "low",
    "cvss_score": 3.3,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "The web server's response headers expose the software name and version number. "
        "Leaking specific version information helps attackers identify known vulnerabilities (CVEs) "
        "associated with that release."
    ),
    "remediation": (
        "Configure your server configuration to suppress version tokens. "
        "For Nginx, add 'server_tokens off;' to your config. "
        "For Apache, set 'ServerTokens Prod' and 'ServerSignature Off'."
    ),
}

FINDING_XPOWERED_LEAK = {
    "title": "X-Powered-By Information Disclosure",
    "category": "info_disclosure",
    "severity": "low",
    "cvss_score": 3.3,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "The response header 'X-Powered-By' discloses technology framework or version information. "
        "This assists attackers in map-fingerprinting your backend application stack."
    ),
    "remediation": (
        "Configure your application server to disable the 'X-Powered-By' header. "
        "For Node.js (Express), use 'app.disable(\"x-powered-by\");'. "
        "For PHP, configure 'expose_php = Off' inside php.ini."
    ),
}

FINDING_CMS_LEAK = {
    "title": "CMS / Framework Version Disclosure",
    "category": "info_disclosure",
    "severity": "low",
    "cvss_score": 3.3,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "The HTML code exposes the CMS or website generator version in a meta tag. "
        "Outdated CMS installations are prime targets for automated exploit bots."
    ),
    "remediation": (
        "Configure your CMS or edit your theme template headers to remove the generator meta tag. "
        "For WordPress, you can add 'remove_action(\"wp_head\", \"wp_generator\");' in functions.php."
    ),
}


def scan_tech(domain: str) -> list:
    """
    Perform passive checks to detect technologies, frameworks, and CMS version disclosures.
    """
    findings = []
    url = f"http://{domain}"

    try:
        headers = {"User-Agent": "CyberGuardian-TechDetector/1.0"}
        response = requests.get(url, headers=headers, timeout=5.0, allow_redirects=True)
        resp_headers = {k.lower(): v for k, v in response.headers.items()}

        # 1. Check Server Header
        server = resp_headers.get("server", "")
        # Look for version numbers in Server header (e.g. Nginx/1.18.0 or Apache/2.4.41)
        if server and re.search(r"\d+\.\d+", server):
            f = FINDING_SERVER_LEAK.copy()
            f["raw_output"] = json.dumps({"header": "Server", "value": server})
            findings.append(f)

        # 2. Check X-Powered-By Header
        x_powered = resp_headers.get("x-powered-by", "")
        if x_powered:
            # Report any powered-by headers as they leak stack details
            f = FINDING_XPOWERED_LEAK.copy()
            f["raw_output"] = json.dumps({"header": "X-Powered-By", "value": x_powered})
            findings.append(f)

        # 3. Check HTML generator tag
        html_body = response.text
        # Regex to locate <meta name="generator" content="..." /> or <meta name='generator' content='...' />
        meta_match = re.search(
            r'<meta\s+name=["\']generator["\']\s+content=["\']([^"\']+)["\']',
            html_body,
            re.IGNORECASE,
        )
        if meta_match:
            generator_content = meta_match.group(1)
            # Only trigger finding if version numbers are leaked in the content
            if re.search(r"\d+\.\d+", generator_content):
                f = FINDING_CMS_LEAK.copy()
                f["raw_output"] = json.dumps({"generator_meta": generator_content})
                findings.append(f)

    except Exception:
        pass

    return findings
