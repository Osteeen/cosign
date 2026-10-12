from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.decision_outcome import DecisionOutcomeOrStr
from .intent_check import IntentCheck, IntentCheckDict
from .reason import Reason, ReasonDict


class Decision(SdkBaseModel):
    """The outcome and every reason behind it."""

    outcome: DecisionOutcomeOrStr
    """What the rules (and the AI check) decided."""

    reasons: list[Reason]
    """Empty when the purchase was simply allowed."""

    rule_version: int | None
    """Version of the slip's rules used. Null when there was no slip."""

    intent_check: IntentCheck
    """The AI purchase check. It runs only when the rules allow the purchase, and can only escalate it to the owner."""


class DecisionDict(TypedDict):
    outcome: DecisionOutcomeOrStr
    reasons: list[ReasonDict]
    rule_version: int | None
    intent_check: IntentCheckDict
