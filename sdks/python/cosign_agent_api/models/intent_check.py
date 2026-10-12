from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.intent_verdict import IntentVerdictOrStr


class IntentCheck(SdkBaseModel):
    """The AI purchase check. It runs only when the rules allow the purchase, and can only escalate it to the owner."""

    verdict: IntentVerdictOrStr
    """SKIPPED when the rules had already decided, or the check is not configured."""

    escalated: bool
    """True when the check turned ALLOW into NEEDS_APPROVAL."""

    summary: str | None
    """Why the check flagged the purchase, in plain words; null when it did not."""


class IntentCheckDict(TypedDict):
    verdict: IntentVerdictOrStr
    escalated: bool
    summary: str | None
