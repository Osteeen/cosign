from __future__ import annotations

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel


class ProblemError(SdkBaseModel):
    """An error (RFC 9457 problem details)."""

    type_: str = Field(alias="type")
    """A URI that identifies the kind of problem."""

    title: str
    """A short, human-readable summary of the kind of problem."""

    status: int
    """The HTTP status code."""

    code: str
    """Stable machine-readable error code."""

    detail: str
    """A plain explanation."""


class ProblemErrorDict(TypedDict):
    type_: str
    title: str
    status: int
    code: str
    detail: str
