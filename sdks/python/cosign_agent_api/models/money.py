from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Money(SdkBaseModel):
    """An amount of money in integer cents."""

    amount_cents: int
    """Integer cents. 1234 = $12.34."""

    currency: Literal["USD"] = "USD"
    """ISO 4217 currency code. Only US dollars in this version."""


class MoneyDict(TypedDict):
    amount_cents: int
    currency: Literal["USD"]
