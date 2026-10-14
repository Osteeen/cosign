from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .market_comparison import MarketComparison, MarketComparisonDict
from .market_offer import MarketOffer, MarketOfferDict


class MarketPrices(SdkBaseModel):
    """Live prices at other retailers (Channel3), for comparison only. These retailers cannot be paid through Cosign;
    titles are third-party text."""

    source: Literal["Channel3"] = "Channel3"
    query: str
    checked: bool
    """False when Channel3 did not answer; then there is no comparison."""

    comparison: MarketComparison | None
    offers: list[MarketOffer]
    """Like-for-like listings when a comparison was made, otherwise the raw listings."""


class MarketPricesDict(TypedDict):
    source: Literal["Channel3"]
    query: str
    checked: bool
    comparison: MarketComparisonDict | None
    offers: list[MarketOfferDict]
