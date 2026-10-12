from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .money import Money, MoneyDict
from .store import Store, StoreDict


class StoreAllowance(SdkBaseModel):
    """A store the agent can pay right now, and what is left in its budget hold."""

    store: Store
    """A store onboarded to Cosign through PayPal Partner Referrals. PayPal IDs are never exposed."""

    remaining_in_hold: Money
    """An amount of money in integer cents."""


class StoreAllowanceDict(TypedDict):
    store: StoreDict
    remaining_in_hold: MoneyDict
