from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.reason_code import ReasonCodeOrStr


class Reason(SdkBaseModel):
    """One reason behind a decision."""

    code: ReasonCodeOrStr
    """Why a purchase was asked about or blocked."""

    message: str
    """Plain words, safe to show a person."""


class ReasonDict(TypedDict):
    code: ReasonCodeOrStr
    message: str
