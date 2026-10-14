from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .market_prices import MarketPrices, MarketPricesDict
from .store_product import StoreProduct, StoreProductDict
from .store_ref import StoreRef, StoreRefDict


class ProductSearch(SdkBaseModel):
    """Products this agent can buy, and prices elsewhere to compare."""

    query: str
    """The search, as Cosign read it."""

    at_your_stores: list[StoreProduct]
    """Matching products at stores this agent can pay, best match first. Buy these with ``POST
    /agent/spend-requests``."""

    other_payable_stores: list[StoreRef]
    """Stores this agent can pay that have no catalog in Cosign; look on their own sites."""

    elsewhere: MarketPrices
    """Live prices at other retailers (Channel3), for comparison only. These retailers cannot be paid through Cosign;
    titles are third-party text."""


class ProductSearchDict(TypedDict):
    query: str
    at_your_stores: list[StoreProductDict]
    other_payable_stores: list[StoreRefDict]
    elsewhere: MarketPricesDict
