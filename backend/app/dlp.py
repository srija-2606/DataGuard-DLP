import re
from typing import Any

# Demo-oriented rules. These patterns are not proof that a value is real or valid.
RULES = [
    ("Email address", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I), 15),
    ("Phone-like number", re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)"), 15),
    ("Aadhaar-like number", re.compile(r"(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)"), 25),
    ("Password assignment", re.compile(r"(?i)\b(password|passwd|pwd)\s*[:=]\s*['\"]?([^\s,'\";]{4,})"), 30),
    ("API-key-like token", re.compile(r"\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})\b"), 35),
]

def mask_value(value: str) -> str:
    if "@" in value:
        local, domain = value.split("@", 1)
        if len(local) <= 2:
            masked_local = local[:1] + "*"
        else:
            masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
        return masked_local + "@" + domain
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 7:
        return "*" * (len(digits) - 4) + digits[-4:]
    if len(value) > 4:
        return value[:2] + "*" * (len(value) - 4) + value[-2:]
    return "*" * len(value)

def scan_text(text: str) -> dict[str, Any]:
    findings = []
    # Keep each finding's original offsets for safe replacement in the returned masked text.
    for category, pattern, weight in RULES:
        for match in pattern.finditer(text):
            value = match.group(2) if category == "Password assignment" else match.group(0)
            start, end = match.span(2) if category == "Password assignment" else match.span()
            findings.append({
                "category": category,
                "masked_value": mask_value(value),
                "start": start,
                "end": end,
                "weight": weight,
            })

    # Remove overlaps, preferring the longer/highest-weight detection.
    findings.sort(key=lambda x: (x["start"], -(x["end"] - x["start"]), -x["weight"]))
    filtered = []
    for item in findings:
        if filtered and item["start"] < filtered[-1]["end"]:
            if item["weight"] > filtered[-1]["weight"]:
                filtered[-1] = item
            continue
        filtered.append(item)

    score = min(100, sum(item["weight"] for item in filtered))
    risk = "HIGH" if score >= 50 else "MEDIUM" if score >= 20 else "LOW"
    action = "BLOCK" if risk == "HIGH" else "WARN" if risk == "MEDIUM" else "ALLOW"

    masked = text
    for item in sorted(filtered, key=lambda x: x["start"], reverse=True):
        masked = masked[:item["start"]] + item["masked_value"] + masked[item["end"]:]

    return {
        "risk_score": score,
        "risk_level": risk,
        "policy_action": action,
        "finding_count": len(filtered),
        "findings": [{"category": x["category"], "masked_value": x["masked_value"]} for x in filtered],
        "masked_text": masked,
        "message": {
            "BLOCK": "High-risk content detected. This submission should be blocked by the configured demo policy.",
            "WARN": "Potentially sensitive content detected. Review before sharing.",
            "ALLOW": "No high-risk patterns detected by the current rules."
        }[action]
    }
