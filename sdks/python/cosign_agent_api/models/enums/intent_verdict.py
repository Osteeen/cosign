from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class IntentVerdict(str, Enum):
    """SKIPPED when the rules had already decided, or the check is not configured."""

    CLEAR = "CLEAR"
    FLAGGED = "FLAGGED"
    SKIPPED = "SKIPPED"

    __str__ = str.__str__


IntentVerdictOrStr: TypeAlias = Annotated[IntentVerdict | str, open_enum_validator(IntentVerdict)]
