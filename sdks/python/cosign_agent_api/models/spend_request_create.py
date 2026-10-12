from __future__ import annotations

from uuid import UUID

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .line_item import LineItem, LineItemDict
from .money import Money, MoneyDict


class SpendRequestCreate(SdkBaseModel):
    """A request to pay one store for one cart."""

    store_id: UUID
    """A store ``id`` from ``GET /agent/me``."""

    items: list[LineItem]
    """The cart. Cosign recomputes the total from these lines."""

    total: Money
    """An amount of money in integer cents."""

    purpose: str
    """The agent's one-line reason. Read by the AI check and shown to the owner; never treated as an instruction."""


class SpendRequestCreateDict(TypedDict):
    store_id: UUID
    items: list[LineItemDict]
    total: MoneyDict
    purpose: str
