from __future__ import annotations

from uuid import UUID

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .decision import Decision, DecisionDict
from .enums.spend_request_status import SpendRequestStatusOrStr
from .line_item import LineItem, LineItemDict
from .money import Money, MoneyDict
from .order_summary import OrderSummary, OrderSummaryDict
from .receipt import Receipt, ReceiptDict


class SpendRequest(SdkBaseModel):
    """A request to pay, and what Cosign decided."""

    id: UUID
    """The spend request's ID."""

    agent_id: UUID
    """The agent that asked."""

    store_id: UUID
    """The store to be paid."""

    items: list[LineItem]
    """The cart as sent."""

    total: Money
    """An amount of money in integer cents."""

    purpose: str
    """The agent's reason, as sent."""

    status: SpendRequestStatusOrStr
    """- ``PROCESSING`` - allowed; the PayPal capture is not confirmed yet. Poll.
      PayPal's own notification (webhook) settles it if the first answer was lost.
    - ``COMPLETED`` - paid. In rare cases PayPal accepts a capture as pending and
      denies it later; the request then becomes ``PAYMENT_FAILED``.
    - ``PENDING_APPROVAL`` - waiting for the owner.
    - ``DENIED`` - blocked by the rules, or declined by the owner.
    - ``APPROVAL_EXPIRED`` - the owner did not decide in time. Nothing was charged.
    - ``PAYMENT_FAILED`` - PayPal refused the capture. Nothing was charged."""

    decision: Decision
    """The outcome and every reason behind it."""

    cart_hash: str
    """SHA-256 of the canonical cart. The owner's approval is bound to it."""

    approval_expires_at: RFC3339DateTime | None
    """When an owner approval would expire; null unless waiting for the owner."""

    receipt: Receipt | None
    """Filled in when the request is COMPLETED."""

    order: OrderSummary | None
    """The order handed to the store once the request is paid; null before that."""

    created_at: RFC3339DateTime
    """When the agent asked."""


class SpendRequestDict(TypedDict):
    id: UUID
    agent_id: UUID
    store_id: UUID
    items: list[LineItemDict]
    total: MoneyDict
    purpose: str
    status: SpendRequestStatusOrStr
    decision: DecisionDict
    cart_hash: str
    approval_expires_at: RFC3339DateTime | None
    receipt: ReceiptDict | None
    order: OrderSummaryDict | None
    created_at: RFC3339DateTime
