import concurrent.futures
import json
import requests

PATHS_TO_CHECK = [
    {"path": "/.env", "type": "env"},
    {"path": "/.git/config", "type": "git"},
    {"path": "/backup.zip", "type": "backup"},
    {"path": "/db.sql", "type": "backup"},
    {"path": "/admin", "type": "admin"},
    {"path": "/phpmyadmin", "type": "admin"},
]

FINDING_EXPOSED_ENV = {
    "title": "Exposed Environment Configuration File (.env)",
    "category": "directories",
    "severity": "critical",
    "cvss_score": 9.8,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "An environment configuration file (.env) was found publicly accessible. "
        "These files contain database passwords, API secret keys, encryption salts, "
        "and other highly sensitive credentials."
    ),
    "remediation": (
        "Configure your server rules to block access to files starting with '.' "
        "(e.g., in Nginx, add a rule: 'location ~ /\\. { deny all; }'). "
        "Additionally, ensure your web server root is set to your 'public/' subdirectory, "
        "not the main project root folder."
    ),
}

FINDING_EXPOSED_GIT = {
    "title": "Exposed Git Repository",
    "category": "directories",
    "severity": "critical",
    "cvss_score": 9.8,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "A public Git metadata directory (/.git/config) was found accessible. "
        "Attackers can download the entire git history, exposing proprietary source code, "
        "commit messages, and hardcoded credentials."
    ),
    "remediation": (
        "Configure your web server (Apache/Nginx) to block access to hidden folders "
        "starting with '.' or delete the '.git' folder from production deployments."
    ),
}

FINDING_EXPOSED_BACKUP = {
    "title": "Exposed Backup Archive / Database Dump",
    "category": "directories",
    "severity": "high",
    "cvss_score": 7.5,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "A publicly accessible database dump (.sql) or backup archive (.zip) was found. "
        "These files often contain outdated database snapshots, credentials, or old source files."
    ),
    "remediation": (
        "Remove all zip archives, tarballs, and SQL dumps from public folders. "
        "Deploy backups to isolated cloud storage buckets."
    ),
}

FINDING_EXPOSED_ADMIN = {
    "title": "Exposed Administrative Portal",
    "category": "directories",
    "severity": "medium",
    "cvss_score": 5.3,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "An administrative interface or database manager (e.g. /admin, /phpmyadmin) was found accessible. "
        "Attackers can target this interface with credential-stuffing or dictionary brute-force attacks."
    ),
    "remediation": (
        "Restrict access to administrative paths behind multi-factor authentication (MFA), "
        "a VPN layer, or server-level IP restrictions."
    ),
}


def check_path(domain: str, check_item: dict) -> tuple:
    """
    Query a specific path to check if it's publicly open and verify headers/contents.
    """
    path = check_item["path"]
    url = f"http://{domain}{path}"
    try:
        # Do not automatically follow redirects to avoid false 200 redirect responses
        headers = {"User-Agent": "CyberGuardian-DirFuzzer/1.0"}
        response = requests.get(url, headers=headers, timeout=1.5, allow_redirects=False)

        if response.status_code == 200:
            content = response.text
            content_lower = content.lower()

            # Content checks to eliminate wildcard-redirect false positives
            if check_item["type"] == "env":
                # Check for standard env configurations
                env_keywords = ["db_", "secret_", "password=", "host=", "key="]
                if any(kw in content_lower for kw in env_keywords):
                    return check_item, True, content[:200]
            elif check_item["type"] == "git":
                # Check for git config structure
                if "[core]" in content_lower or "repositoryformatversion" in content_lower:
                    return check_item, True, content[:200]
            elif check_item["type"] == "backup":
                # Ensure it is not an HTML page returning code 200
                if "html" not in content_lower and "<!doctype" not in content_lower:
                    return check_item, True, f"Length: {len(content)}"
            elif check_item["type"] == "admin":
                # Standard admin check (content-length must be non-trivial)
                if len(content) > 50:
                    return check_item, True, f"Title Check/Length: {len(content)}"

    except Exception:
        pass
    return check_item, False, None


def scan_directories(domain: str) -> list:
    """
    Concurrently scan target domain for exposed sensitive paths.
    """
    findings = []
    found_items = []

    # Run path audits concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(PATHS_TO_CHECK)) as executor:
        futures = [executor.submit(check_path, domain, item) for item in PATHS_TO_CHECK]
        for future in concurrent.futures.as_completed(futures):
            item, is_found, snippet = future.result()
            if is_found:
                found_items.append((item, snippet))

    # Convert findings
    for item, snippet in found_items:
        path = item["path"]
        if item["type"] == "env":
            f = FINDING_EXPOSED_ENV.copy()
            f["title"] = f"Exposed Environment Config File (at {path})"
            f["raw_output"] = json.dumps({"path": path, "snippet": snippet})
            findings.append(f)
        elif item["type"] == "git":
            f = FINDING_EXPOSED_GIT.copy()
            f["title"] = f"Exposed Git Directory (at {path})"
            f["raw_output"] = json.dumps({"path": path, "snippet": snippet})
            findings.append(f)
        elif item["type"] == "backup":
            f = FINDING_EXPOSED_BACKUP.copy()
            f["title"] = f"Exposed Backup/SQL Dump (at {path})"
            f["raw_output"] = json.dumps({"path": path, "details": snippet})
            findings.append(f)
        elif item["type"] == "admin":
            f = FINDING_EXPOSED_ADMIN.copy()
            f["title"] = f"Exposed Administrative Portal (at {path})"
            f["raw_output"] = json.dumps({"path": path, "details": snippet})
            findings.append(f)

    return findings
