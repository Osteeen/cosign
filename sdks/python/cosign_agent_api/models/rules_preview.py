from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.decision_outcome import DecisionOutcomeOrStr
from .reason import Reason, ReasonDict


class RulesPreview(SdkBaseModel):
    """What the rules alone would decide for buying one of this product now. The AI purchase check can still send a real
    purchase to the owner."""

    outcome: DecisionOutcomeOrStr
    """What the rules (and the AI check) decided."""

    reasons: list[Reason]


class RulesPreviewDict(TypedDict):
    outcome: DecisionOutcomeOrStr
    reasons: list[ReasonDict]
