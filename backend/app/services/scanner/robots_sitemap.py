import json
import requests

FINDING_SENSITIVE_DISALLOW = {
    "title": "Sensitive Paths Disclosed in robots.txt",
    "category": "info_disclosure",
    "severity": "low",
    "cvss_score": 3.3,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "Your 'robots.txt' file disallows search engine indexing on sensitive directories "
        "(such as admin control panels, databases, or backup folders). While this prevents crawlers "
        "from indexing these paths, it publicly exposes their locations to attackers who can target them."
    ),
    "remediation": (
        "Do not disclose hidden, sensitive URLs in 'robots.txt'. Instead, enforce security on those endpoints "
        "using proper authentication, authorization, or IP-based access limits."
    ),
}

FINDING_MISSING_ROBOTS = {
    "title": "robots.txt File Missing",
    "category": "dns",  # General discovery category
    "severity": "info",
    "cvss_score": 0.0,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "No 'robots.txt' file was found at the root of the server. Web crawlers will "
        "crawl the entire site structure by default."
    ),
    "remediation": (
        "Publish a basic 'robots.txt' file at your root directory to guide search engine spiders."
    ),
}

FINDING_SITEMAP_DISCOVERED = {
    "title": "Sitemap Configuration Discovered",
    "category": "dns",
    "severity": "info",
    "cvss_score": 0.0,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "A public 'sitemap.xml' configuration was successfully resolved. Sitemaps aid search engine indexing."
    ),
    "remediation": (
        "Verify that your sitemap lists only public pages, and does not include internal testing "
        "or development paths."
    ),
}


def scan_robots_sitemap(domain: str) -> list:
    """
    Query robots.txt and sitemap.xml to identify path disclosures or missing config files.
    """
    findings = []
    headers = {"User-Agent": "CyberGuardian-PathAuditor/1.0"}

    # 1. robots.txt audit
    robots_url = f"http://{domain}/robots.txt"
    has_robots = False
    try:
        response = requests.get(robots_url, headers=headers, timeout=5.0, allow_redirects=True)
        if response.status_code == 200:
            has_robots = True
            lines = response.text.split("\n")
            disallowed_sensitive = []
            sensitive_keywords = ["admin", "config", "backup", "secret", "db", "private", "sql", "mysql", "dump", "wp-admin"]

            for line in lines:
                line_clean = line.strip().lower()
                if line_clean.startswith("disallow:"):
                    # Extract the disallowed path
                    path = line_clean.split("disallow:")[1].strip()
                    # Check if any sensitive keywords match the disallowed path
                    if any(keyword in path for keyword in sensitive_keywords):
                        disallowed_sensitive.append(path)

            if disallowed_sensitive:
                f = FINDING_SENSITIVE_DISALLOW.copy()
                f["raw_output"] = json.dumps({"disclosed_disallows": disallowed_sensitive})
                findings.append(f)
    except Exception:
        pass

    if not has_robots:
        f = FINDING_MISSING_ROBOTS.copy()
        f["raw_output"] = json.dumps({"robots_txt": "missing"})
        findings.append(f)

    # 2. sitemap.xml audit
    sitemap_url = f"http://{domain}/sitemap.xml"
    try:
        response = requests.get(sitemap_url, headers=headers, timeout=5.0, allow_redirects=True)
        if response.status_code == 200:
            f = FINDING_SITEMAP_DISCOVERED.copy()
            f["raw_output"] = json.dumps({"sitemap_url": sitemap_url, "content_length": len(response.text)})
            findings.append(f)
    except Exception:
        pass

    return findings
