from __future__ import annotations

from uuid import UUID

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class StoreSummary(SdkBaseModel):
    """A store this agent can pay."""

    id: UUID
    """Use as ``store_id`` when asking to pay."""

    name: str


class StoreSummaryDict(TypedDict):
    id: UUID
    name: str
