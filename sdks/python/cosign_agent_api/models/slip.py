from __future__ import annotations

from uuid import UUID

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .enums.category import CategoryOrStr
from .money import Money, MoneyDict
from .store_allowance import StoreAllowance, StoreAllowanceDict


class Slip(SdkBaseModel):
    """The agent's active permission slip, as the agent sees it."""

    slip_id: UUID
    """The slip's ID."""

    period_days: int
    """Length of one budget period. At most 28 days, so a period fits inside one 29-day PayPal hold."""

    period_ends_at: RFC3339DateTime
    """When the current budget period ends."""

    remaining_this_period: Money
    """An amount of money in integer cents."""

    per_purchase_max: Money
    """An amount of money in integer cents."""

    approve_above: Money
    """An amount of money in integer cents."""

    categories: list[CategoryOrStr]
    """Categories the agent may buy."""

    expires_at: RFC3339DateTime | None
    """When the slip ends for good, or null if the owner set no end date."""

    stores: list[StoreAllowance]
    """Only stores with an approved budget hold for this period."""


class SlipDict(TypedDict):
    slip_id: UUID
    period_days: int
    period_ends_at: RFC3339DateTime
    remaining_this_period: MoneyDict
    per_purchase_max: MoneyDict
    approve_above: MoneyDict
    categories: list[CategoryOrStr]
    expires_at: RFC3339DateTime | None
    stores: list[StoreAllowanceDict]
