from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .spend_request import SpendRequest, SpendRequestDict


class SpendRequestList(SdkBaseModel):
    """A page of spend requests, newest first."""

    data: list[SpendRequest]
    """The requests."""

    next_cursor: str | None
    """Always null in this version."""


class SpendRequestListDict(TypedDict):
    data: list[SpendRequestDict]
    next_cursor: str | None
