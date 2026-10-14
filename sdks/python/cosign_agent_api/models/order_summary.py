from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.order_status import OrderStatusOrStr


class OrderSummary(SdkBaseModel):
    """What the agent may know about the order a paid purchase created. The store gets the items and the owner's
    address; the agent only sees the address label and whether the store has seen or shipped it."""

    status: OrderStatusOrStr
    """``SENT`` to the store, ``SEEN`` (the store confirmed it), ``SHIPPED``, or ``CANCELLED`` (PayPal did not complete
    the payment, or it was fully refunded)."""

    ships_to: str | None
    """The label of the owner's address it ships to, or null when nothing ships."""


class OrderSummaryDict(TypedDict):
    status: OrderStatusOrStr
    ships_to: str | None
