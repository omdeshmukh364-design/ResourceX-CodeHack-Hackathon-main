import re
from typing import List, Optional
from fastapi import HTTPException, status
from backend.app.config import settings

# RFC 5322 simplified strict regex
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def normalize_email(email: str) -> str:
    """Normalize email address by trimming whitespace and converting to lowercase."""
    if not email:
        return ""
    return email.strip().lower()


def validate_student_email_domain(email: str, allowed_domains: Optional[List[str]] = None) -> str:
    """
    Validate that an email address belongs exactly to the allowed college domain.
    Rejects:
      - Personal email domains (gmail, yahoo, outlook, etc.)
      - Lookalike / Subdomain attacks (e.g. om@pcu.edu.in.attacker.com, om@fakepcu.edu.in)
      - Invalid formats
    """
    normalized = normalize_email(email)
    if not normalized or not EMAIL_REGEX.match(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format."
        )

    parts = normalized.split("@")
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format: must contain exactly one '@'."
        )

    username, domain = parts
    if not username or not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email: username or domain missing."
        )

    domains = allowed_domains or settings.allowed_domains
    # Strict exact equality match on domain
    if domain not in domains:
        allowed_str = ", ".join(f"@{d}" for d in domains)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Registration restricted. Only official college email addresses ({allowed_str}) are permitted. '{domain}' is unauthorized."
        )

    return normalized
