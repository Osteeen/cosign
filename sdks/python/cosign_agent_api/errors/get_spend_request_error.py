from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

GetSpendRequestErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _GetSpendRequestError:
    def map(self, status_code: int, content: bytes) -> GetSpendRequestErrorBody:
        match status_code:
            case 401 | 404 | 500:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


get_spend_request_error_mapper: Final[ErrorMapper[GetSpendRequestErrorBody]] = _GetSpendRequestError()
