from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel
from .enums.category import CategoryOrStr


class LineItem(SdkBaseModel):
    """One line of the cart."""

    name: str
    """What is being bought, as the store names it."""

    category: CategoryOrStr
    """Purchase categories a slip can allow."""

    quantity: int
    """How many."""

    unit_amount_cents: int
    """Price of one unit in integer cents."""

    product_url: Optional[str] = UNSET
    """The product page. Shown to the owner; Cosign never fetches it."""


class LineItemDict(TypedDict):
    name: str
    category: CategoryOrStr
    quantity: int
    unit_amount_cents: int
    product_url: NotRequired[str]
