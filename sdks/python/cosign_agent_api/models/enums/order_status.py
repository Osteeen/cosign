from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class OrderStatus(str, Enum):
    """``SENT`` to the store, ``SEEN`` (the store confirmed it), ``SHIPPED``, or ``CANCELLED`` (PayPal did not complete
    the payment, or it was fully refunded)."""

    SENT = "SENT"
    SEEN = "SEEN"
    SHIPPED = "SHIPPED"
    CANCELLED = "CANCELLED"

    __str__ = str.__str__


OrderStatusOrStr: TypeAlias = Annotated[OrderStatus | str, open_enum_validator(OrderStatus)]
