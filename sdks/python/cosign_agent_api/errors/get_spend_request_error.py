from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError

GetSpendRequestErrorBody: TypeAlias = RawError


@dataclass(frozen=True, slots=True)
class _GetSpendRequestError:
    def map(self, status_code: int, content: bytes) -> GetSpendRequestErrorBody:
        match status_code:
            case 401 | 404 | 500:
                return RawError(status_code, content)
            case _:
                return RawError(status_code, content)


get_spend_request_error_mapper: Final[ErrorMapper[GetSpendRequestErrorBody]] = _GetSpendRequestError()
