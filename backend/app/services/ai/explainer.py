import json
import logging
import re
import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


def extract_json_object(text: str) -> dict:
    """
    Locates and parses the first JSON object inside a string,
    cleaning up any surrounding markdown wrapper code blocks.
    """
    # 1. Search for markdown code blocks (e.g. ```json ... ```)
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return json.loads(match.group(1))

    # 2. Fall back to finding the outer braces
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        return json.loads(text[start : end + 1])

    raise ValueError("No JSON object could be located in text.")


def explain_finding(title: str, category: str, severity: str, raw_output: str) -> dict:
    """
    Call Gemini API to generate plain-English explanations and CVSS/OWASP/MITRE mapping parameters.
    Returns parsed dictionary if successful, or None if unconfigured or failed.
    """
    if not settings.GEMINI_API_KEY:
        logger.info("Gemini API key not configured; skipping AI explanation pipeline.")
        return None

    # Construct the instruction prompt
    prompt = (
        "You are an expert Security Engineer and Pen-tester. Analyze the raw scanner finding below and "
        "write a developer-friendly explanation and code-remediation guide.\n\n"
        f"Vulnerability Title: {title}\n"
        f"Category: {category}\n"
        f"Severity: {severity}\n"
        f"Raw Output: {raw_output}\n\n"
        "You must respond ONLY with a single JSON object containing these keys. "
        "Do not include any chat prefix or suffix outside the JSON block. "
        "Schema:\n"
        "{\n"
        '  "explanation": "A plain-English explanation of the security risk and its impact.",\n'
        '  "exec_summary": "A one-line executive summary of the vulnerability, short and without technical jargon.",\n'
        '  "remediation": "Step-by-step remediation guide showing developers how to secure it.",\n'
        '  "cvss_score": 5.5,  # float representation of CVSS v3 score (0.0 to 10.0)\n'
        '  "owasp_mapping": "A05:2021-Security Misconfiguration",  # string naming the OWASP category or null\n'
        '  "mitre_mapping": "T1566"  # string naming the MITRE ATT&CK technique code or null\n'
        "}"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=8.0)
        if response.status_code == 200:
            res_data = response.json()
            # Extract content from response structure
            candidates = res_data.get("candidates", [])
            if candidates:
                text_response = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if text_response:
                    return extract_json_object(text_response)
        else:
            logger.warning(f"Gemini API returned status code {response.status_code}: {response.text}")
    except Exception as e:
        logger.warning(f"Gemini API execution failed: {str(e)}")

    return None
