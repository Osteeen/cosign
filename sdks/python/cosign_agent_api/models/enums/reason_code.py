from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class ReasonCode(str, Enum):
    """Why a purchase was asked about or blocked."""

    AGENT_PAUSED = "AGENT_PAUSED"
    AGENT_REVOKED = "AGENT_REVOKED"
    NO_ACTIVE_SLIP = "NO_ACTIVE_SLIP"
    SLIP_EXPIRED = "SLIP_EXPIRED"
    CURRENCY_MISMATCH = "CURRENCY_MISMATCH"
    TOTAL_MISMATCH = "TOTAL_MISMATCH"
    STORE_NOT_ALLOWED = "STORE_NOT_ALLOWED"
    NO_ACTIVE_HOLD = "NO_ACTIVE_HOLD"
    HOLD_INSUFFICIENT = "HOLD_INSUFFICIENT"
    CATEGORY_NOT_ALLOWED = "CATEGORY_NOT_ALLOWED"
    OVER_PER_PURCHASE_MAX = "OVER_PER_PURCHASE_MAX"
    OVER_PERIOD_BUDGET = "OVER_PERIOD_BUDGET"
    ABOVE_APPROVAL_THRESHOLD = "ABOVE_APPROVAL_THRESHOLD"
    INTENT_FLAGGED = "INTENT_FLAGGED"

    __str__ = str.__str__


ReasonCodeOrStr: TypeAlias = Annotated[ReasonCode | str, open_enum_validator(ReasonCode)]
