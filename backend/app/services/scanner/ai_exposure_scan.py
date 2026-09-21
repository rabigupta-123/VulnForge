import re
import requests

# API Key Patterns
KEY_PATTERNS = {
    "OpenAI API Key": r"sk-[a-zA-Z0-9]{48}|sk-proj-[a-zA-Z0-9\-]{40,80}",
    "Anthropic API Key": r"sk-ant-[a-zA-Z0-9\-]{50,120}",
    "Google Cloud API Key": r"AIzaSy[a-zA-Z0-9\-_]{33}",
}

CONFIG_PATHS = [
    "/.well-known/ai-plugin.json",
    "/openapi.json",
    "/swagger.json"
]


def scan_ai_exposure(domain: str, timeout: float = 2.0) -> list[dict]:
    findings = []
    
    # Standardize URL
    base_url = f"https://{domain}"
    
    # 1. Check well-known config/spec paths
    for path in CONFIG_PATHS:
        url = f"{base_url}{path}"
        try:
            resp = requests.get(url, timeout=timeout, allow_redirects=True)
            if resp.status_code == 200:
                content = resp.text
                for key_name, pattern in KEY_PATTERNS.items():
                    matches = re.findall(pattern, content)
                    if matches:
                        findings.append({
                            "title": f"Exposed {key_name} in Spec File",
                            "category": "ai_exposure",
                            "severity": "critical",
                            "cvss_score": 9.8,
                            "owasp_mapping": "A02:2021-Cryptographic Failures",
                            "description": f"A hardcoded credential matching the {key_name} format was found exposed in the publicly accessible spec file at {path}.",
                            "remediation": f"Immediately revoke the exposed API key in your provider dashboard and migrate it to secure server-side environment variables.",
                            "raw_output": {"path": path, "key_type": key_name, "found_matches_count": len(matches)},
                        })
        except Exception:
            pass

    # 2. Inspect homepage and its script references
    try:
        home_resp = requests.get(base_url, timeout=timeout, allow_redirects=True)
        if home_resp.status_code == 200:
            home_text = home_resp.text
            
            # Check homepage source directly
            for key_name, pattern in KEY_PATTERNS.items():
                matches = re.findall(pattern, home_text)
                if matches:
                    findings.append({
                        "title": f"Exposed {key_name} in HTML Source",
                        "category": "ai_exposure",
                        "severity": "critical",
                        "cvss_score": 9.8,
                        "owasp_mapping": "A02:2021-Cryptographic Failures",
                        "description": f"A hardcoded credential matching the {key_name} pattern was found embedded in the homepage HTML source.",
                        "remediation": "Revoke the exposed key and move credentials to secure, server-side configuration management systems.",
                        "raw_output": {"path": "/", "key_type": key_name, "found_matches_count": len(matches)},
                    })

            # Extract script URLs using regex
            script_srcs = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', home_text)
            for src in set(script_srcs):
                # Resolve script URL
                if src.startswith("//"):
                    script_url = f"https:{src}"
                elif src.startswith("/"):
                    script_url = f"{base_url}{src}"
                elif src.startswith("http"):
                    script_url = src
                else:
                    script_url = f"{base_url}/{src}"

                try:
                    js_resp = requests.get(script_url, timeout=timeout, allow_redirects=True)
                    if js_resp.status_code == 200:
                        js_text = js_resp.text
                        for key_name, pattern in KEY_PATTERNS.items():
                            matches = re.findall(pattern, js_text)
                            if matches:
                                findings.append({
                                    "title": f"Exposed {key_name} in JavaScript Bundle",
                                    "category": "ai_exposure",
                                    "severity": "critical",
                                    "cvss_score": 9.8,
                                    "owasp_mapping": "A02:2021-Cryptographic Failures",
                                    "description": f"A hardcoded credential matching the {key_name} pattern was discovered inside the public JavaScript asset bundle at {src}.",
                                    "remediation": "Immediately deactivate this API key and refactor the code to call backend proxy APIs rather than invoking provider systems from frontend client scripts.",
                                    "raw_output": {"script_src": src, "key_type": key_name, "found_matches_count": len(matches)},
                                })
                except Exception:
                    pass
    except Exception:
        pass

    return findings
