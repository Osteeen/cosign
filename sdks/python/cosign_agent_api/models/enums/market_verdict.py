from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class MarketVerdict(str, Enum):
    """How a price compares with like-for-like listings; ``none`` when no listing was comparable."""

    BELOW = "below"
    ABOUT = "about"
    ABOVE = "above"
    NONE = "none"

    __str__ = str.__str__


MarketVerdictOrStr: TypeAlias = Annotated[MarketVerdict | str, open_enum_validator(MarketVerdict)]
