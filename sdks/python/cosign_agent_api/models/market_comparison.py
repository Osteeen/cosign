from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.market_verdict import MarketVerdictOrStr


class MarketComparison(SdkBaseModel):
    """How the best match's price compares with like-for-like listings, judged by AI."""

    product: str
    verdict: MarketVerdictOrStr
    """How a price compares with like-for-like listings; ``none`` when no listing was comparable."""

    note: str


class MarketComparisonDict(TypedDict):
    product: str
    verdict: MarketVerdictOrStr
    note: str
