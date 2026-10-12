from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .money import Money, MoneyDict


class Receipt(SdkBaseModel):
    """Proof of payment for a completed request."""

    receipt_id: str
    """Cosign's receipt ID."""

    paid: Money
    """An amount of money in integer cents."""

    paid_at: RFC3339DateTime
    """When PayPal paid the store."""


class ReceiptDict(TypedDict):
    receipt_id: str
    paid: MoneyDict
    paid_at: RFC3339DateTime
