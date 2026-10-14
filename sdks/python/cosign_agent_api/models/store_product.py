from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.category import CategoryOrStr
from .money import Money, MoneyDict
from .rules_preview import RulesPreview, RulesPreviewDict
from .store_summary import StoreSummary, StoreSummaryDict


class StoreProduct(SdkBaseModel):
    """One product at a store this agent can pay."""

    store: StoreSummary
    """A store this agent can pay."""

    name: str
    category: CategoryOrStr
    """Purchase categories a slip can allow."""

    unit: str
    """What one unit is."""

    unit_price: Money
    """An amount of money in integer cents."""

    product_url: str
    if_you_buy_one: RulesPreview
    """What the rules alone would decide for buying one of this product now. The AI purchase check can still send a real
    purchase to the owner."""


class StoreProductDict(TypedDict):
    store: StoreSummaryDict
    name: str
    category: CategoryOrStr
    unit: str
    unit_price: MoneyDict
    product_url: str
    if_you_buy_one: RulesPreviewDict
