from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class AgentToken(SdkBaseModel):
    """A short-lived token for the agent API."""

    access_token: str
    """Send it as ``Authorization: Bearer <access_token>``."""

    token_type: Literal["Bearer"] = "Bearer"
    """How to send the token."""

    expires_in: int
    """Seconds until it expires. 900 in this version."""


class AgentTokenDict(TypedDict):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
