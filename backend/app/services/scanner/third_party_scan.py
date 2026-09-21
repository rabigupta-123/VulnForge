import re
import requests

VULNERABLE_LIBRARIES = [
    {
        "name": "jQuery",
        "regex": r"jquery[.-]([0-2]\.[0-9]+\.[0-9]+|3\.[0-6]\.[0-9]+)",
        "severity": "medium",
        "cvss_score": 6.1,
        "owasp_mapping": "A06:2021-Vulnerable and Outdated Components",
        "description": "Outdated jQuery library versions (prior to 3.7.0) contain cross-site scripting (XSS) vulnerabilities.",
        "remediation": "Upgrade jQuery to version 3.7.0 or higher."
    },
    {
        "name": "Bootstrap",
        "regex": r"bootstrap[.-]([0-3]\.[0-9]+\.[0-9]+|4\.[0-5]\.[0-9]+)",
        "severity": "high",
        "cvss_score": 7.5,
        "owasp_mapping": "A06:2021-Vulnerable and Outdated Components",
        "description": "Older Bootstrap library versions (prior to 4.6.0) carry known vulnerabilities (XSS, HTTP Response Splitting).",
        "remediation": "Upgrade Bootstrap layout scripts to version 4.6.0 or higher."
    }
]


def scan_third_party_scripts(domain: str, timeout: float = 2.0) -> list[dict]:
    findings = []
    
    base_url = f"https://{domain}"
    try:
        resp = requests.get(base_url, timeout=timeout, allow_redirects=True)
        if resp.status_code != 200:
            return findings

        html_content = resp.text
        
        # 1. Parse external scripts and links
        urls = []
        urls.extend(re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html_content))
        urls.extend(re.findall(r'<link[^>]+href=["\']([^"\']+)["\']', html_content))
        
        for url in set(urls):
            for lib in VULNERABLE_LIBRARIES:
                match = re.search(lib["regex"], url, re.IGNORECASE)
                if match:
                    version = match.group(1)
                    findings.append({
                        "title": f"Vulnerable Third-Party Library: {lib['name']} {version}",
                        "category": "third_party_script",
                        "severity": lib["severity"],
                        "cvss_score": lib["cvss_score"],
                        "owasp_mapping": lib["owasp_mapping"],
                        "description": f"{lib['description']} Detected version {version} loaded from resource: {url}",
                        "remediation": lib["remediation"],
                        "raw_output": {"library": lib["name"], "detected_version": version, "resource_url": url},
                    })
    except Exception:
        pass

    return findings
