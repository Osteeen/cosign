from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

ListSpendRequestsErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _ListSpendRequestsError:
    def map(self, status_code: int, content: bytes) -> ListSpendRequestsErrorBody:
        match status_code:
            case 401 | 500:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


list_spend_requests_error_mapper: Final[ErrorMapper[ListSpendRequestsErrorBody]] = _ListSpendRequestsError()
