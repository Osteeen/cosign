from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class AgentStatus(str, Enum):
    """Whether the agent may spend. Paused agents are denied; revoked agents cannot authenticate."""

    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    REVOKED = "REVOKED"

    __str__ = str.__str__


AgentStatusOrStr: TypeAlias = Annotated[AgentStatus | str, open_enum_validator(AgentStatus)]
