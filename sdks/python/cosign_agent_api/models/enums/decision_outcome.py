from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class DecisionOutcome(str, Enum):
    """What the rules (and the AI check) decided."""

    ALLOW = "ALLOW"
    NEEDS_APPROVAL = "NEEDS_APPROVAL"
    DENY = "DENY"

    __str__ = str.__str__


DecisionOutcomeOrStr: TypeAlias = Annotated[DecisionOutcome | str, open_enum_validator(DecisionOutcome)]
