from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class SpendRequestStatus(str, Enum):
    """- ``PROCESSING`` - allowed; the PayPal capture is not confirmed yet. Poll.
    - ``COMPLETED`` - paid.
    - ``PENDING_APPROVAL`` - waiting for the owner.
    - ``DENIED`` - blocked by the rules, or declined by the owner.
    - ``APPROVAL_EXPIRED`` - the owner did not decide in time. Nothing was charged.
    - ``PAYMENT_FAILED`` - PayPal refused the capture. Nothing was charged."""

    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    DENIED = "DENIED"
    APPROVAL_EXPIRED = "APPROVAL_EXPIRED"
    PAYMENT_FAILED = "PAYMENT_FAILED"

    __str__ = str.__str__


SpendRequestStatusOrStr: TypeAlias = Annotated[SpendRequestStatus | str, open_enum_validator(SpendRequestStatus)]
