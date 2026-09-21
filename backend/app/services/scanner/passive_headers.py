import json
import requests

FINDING_MISSING_CSP = {
    "title": "Missing Content Security Policy (CSP) Header",
    "category": "headers",
    "severity": "medium",
    "cvss_score": 5.3,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "Content Security Policy (CSP) header is missing on the server response. "
        "CSP prevents Cross-Site Scripting (XSS) and code injection attacks by restricting "
        "the sources from which dynamic scripts, stylesheets, and frames can be loaded."
    ),
    "remediation": (
        "Configure your server to send the 'Content-Security-Policy' header. "
        "Example: \"Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted.com;\"."
    ),
}

FINDING_MISSING_HSTS = {
    "title": "Missing HTTP Strict Transport Security (HSTS) Header",
    "category": "headers",
    "severity": "low",
    "cvss_score": 3.7,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "HTTP Strict Transport Security (HSTS) header is missing. HSTS forces browsers to communicate "
        "with your website exclusively over encrypted HTTPS connections, mitigating man-in-the-middle "
        "and protocol downgrade attacks."
    ),
    "remediation": (
        "Add the 'Strict-Transport-Security' header to your HTTPS responses. "
        "Example: 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload'."
    ),
}

FINDING_MISSING_XFRAME = {
    "title": "Missing X-Frame-Options (Clickjacking Protection) Header",
    "category": "headers",
    "severity": "low",
    "cvss_score": 3.7,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "The 'X-Frame-Options' header is missing. This allows attackers to embed your site "
        "inside a frame or iframe on a malicious website, enabling Clickjacking/UI Redress attacks "
        "to trick users into clicking buttons they did not intend to."
    ),
    "remediation": (
        "Configure your server to return 'X-Frame-Options: DENY' or 'X-Frame-Options: SAMEORIGIN'."
    ),
}

FINDING_MISSING_XCONTENT = {
    "title": "Missing X-Content-Type-Options Header",
    "category": "headers",
    "severity": "low",
    "cvss_score": 3.1,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "The 'X-Content-Type-Options' header is missing. Without this, browsers might attempt to "
        "guess the MIME type of a file (MIME sniffing), which can lead to XSS if a user uploads a malicious "
        "script disguised as an image."
    ),
    "remediation": (
        "Configure your server to return 'X-Content-Type-Options: nosniff'."
    ),
}

FINDING_INSECURE_COOKIE = {
    "title": "Insecure Cookie Configuration",
    "category": "cookies",
    "severity": "low",
    "cvss_score": 3.7,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "One or more cookies set by the server are missing the 'HttpOnly' or 'Secure' flags. "
        "The 'HttpOnly' flag prevents scripts from accessing the cookie (mitigating XSS theft), "
        "while the 'Secure' flag ensures the cookie is only transmitted over encrypted connections."
    ),
    "remediation": (
        "Modify your backend session/cookie configuration to append the 'HttpOnly' and 'Secure' attributes "
        "to all set-cookie directives."
    ),
}

FINDING_CORS_WILDCARD = {
    "title": "Permissive Wildcard CORS Configuration",
    "category": "cors",
    "severity": "low",
    "cvss_score": 3.7,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "The Cross-Origin Resource Sharing (CORS) configuration returns an 'Access-Control-Allow-Origin: *' "
        "wildcard header. If your API hosts sensitive user data, this wildcard configuration allow "
        "arbitrary external scripts to read your API payloads."
    ),
    "remediation": (
        "Specify explicit origin domains in 'Access-Control-Allow-Origin' rather than wildcarding (*), "
        "especially if credentials are permitted."
    ),
}


def scan_headers(domain: str) -> list:
    """
    Perform passive checks on response headers, cookie flags, and CORS configurations.
    """
    findings = []
    url = f"http://{domain}"

    try:
        # User-Agent header with short timeout
        headers = {"User-Agent": "CyberGuardian-Scanner/1.0"}
        response = requests.get(url, headers=headers, timeout=5.0, allow_redirects=True)
        resp_headers = {k.lower(): v for k, v in response.headers.items()}

        # 1. CSP Check
        if "content-security-policy" not in resp_headers:
            f = FINDING_MISSING_CSP.copy()
            f["raw_output"] = json.dumps({"header": "Content-Security-Policy", "status": "missing"})
            findings.append(f)

        # 2. HSTS Check
        if "strict-transport-security" not in resp_headers:
            f = FINDING_MISSING_HSTS.copy()
            f["raw_output"] = json.dumps({"header": "Strict-Transport-Security", "status": "missing"})
            findings.append(f)

        # 3. X-Frame-Options Check
        if "x-frame-options" not in resp_headers:
            f = FINDING_MISSING_XFRAME.copy()
            f["raw_output"] = json.dumps({"header": "X-Frame-Options", "status": "missing"})
            findings.append(f)

        # 4. X-Content-Type-Options Check
        x_content = resp_headers.get("x-content-type-options", "")
        if "nosniff" not in x_content.lower():
            f = FINDING_MISSING_XCONTENT.copy()
            f["raw_output"] = json.dumps({"header": "X-Content-Type-Options", "value": x_content})
            findings.append(f)

        # 5. Cookie Flags Check
        # Inspect raw cookies sent in response headers
        raw_cookies = response.headers.get("Set-Cookie")
        if raw_cookies:
            # Split cookies if multiple are set
            cookies_list = [c.strip() for c in raw_cookies.split(",")]
            insecure_found = False
            details = []
            for cookie in cookies_list:
                cookie_lower = cookie.lower()
                has_httponly = "httponly" in cookie_lower
                has_secure = "secure" in cookie_lower
                if not has_httponly or not has_secure:
                    insecure_found = True
                    details.append(
                        {
                            "cookie": cookie.split("=")[0],
                            "has_httponly": has_httponly,
                            "has_secure": has_secure,
                        }
                    )
            if insecure_found:
                f = FINDING_INSECURE_COOKIE.copy()
                f["raw_output"] = json.dumps({"cookies": details})
                findings.append(f)

        # 6. CORS Check
        cors_allow = resp_headers.get("access-control-allow-origin", "")
        if cors_allow == "*":
            f = FINDING_CORS_WILDCARD.copy()
            f["raw_output"] = json.dumps({"Access-Control-Allow-Origin": "*"})
            findings.append(f)

    except Exception as e:
        # If the target host cannot be resolved or is down, skip header checks
        # (This will be logged/caught in the worker scan runner)
        pass

    return findings
