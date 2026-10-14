from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .money import Money, MoneyDict


class MarketOffer(SdkBaseModel):
    title: str
    """The retailer's own product title (third-party text)."""

    merchant_domain: str
    price: Money
    """An amount of money in integer cents."""


class MarketOfferDict(TypedDict):
    title: str
    merchant_domain: str
    price: MoneyDict
