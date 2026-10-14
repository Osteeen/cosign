from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

CreateSpendRequestErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _CreateSpendRequestError:
    def map(self, status_code: int, content: bytes) -> CreateSpendRequestErrorBody:
        match status_code:
            case 400 | 401 | 409 | 429 | 500:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


create_spend_request_error_mapper: Final[ErrorMapper[CreateSpendRequestErrorBody]] = _CreateSpendRequestError()
