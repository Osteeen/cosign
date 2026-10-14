from __future__ import annotations

from uuid import UUID

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class StoreRef(SdkBaseModel):
    id: UUID
    name: str
    website: str | None


class StoreRefDict(TypedDict):
    id: UUID
    name: str
    website: str | None
