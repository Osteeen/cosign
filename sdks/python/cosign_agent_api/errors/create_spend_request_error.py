from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError

CreateSpendRequestErrorBody: TypeAlias = RawError


@dataclass(frozen=True, slots=True)
class _CreateSpendRequestError:
    def map(self, status_code: int, content: bytes) -> CreateSpendRequestErrorBody:
        match status_code:
            case 400 | 401 | 409 | 429 | 500:
                return RawError(status_code, content)
            case _:
                return RawError(status_code, content)


create_spend_request_error_mapper: Final[ErrorMapper[CreateSpendRequestErrorBody]] = _CreateSpendRequestError()
