from __future__ import annotations

from uuid import UUID

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.category import CategoryOrStr


class Store(SdkBaseModel):
    """A store onboarded to Cosign through PayPal Partner Referrals. PayPal IDs are never exposed."""

    id: UUID
    """Use as ``store_id`` when asking to pay."""

    name: str
    """The store's name."""

    categories: list[CategoryOrStr]
    """What the store sells."""

    website: str | None
    """The store's website, where an agent can browse products."""


class StoreDict(TypedDict):
    id: UUID
    name: str
    categories: list[CategoryOrStr]
    website: str | None
