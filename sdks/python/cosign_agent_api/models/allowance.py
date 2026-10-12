from __future__ import annotations

from uuid import UUID

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.agent_status import AgentStatusOrStr
from .slip import Slip, SlipDict


class Allowance(SdkBaseModel):
    """What the agent may spend right now."""

    agent_id: UUID
    """This agent's ID."""

    status: AgentStatusOrStr
    """Whether the agent may spend. Paused agents are denied; revoked agents cannot authenticate."""

    slip: Slip | None
    """The active permission slip, or null when the agent has none."""


class AllowanceDict(TypedDict):
    agent_id: UUID
    status: AgentStatusOrStr
    slip: SlipDict | None
