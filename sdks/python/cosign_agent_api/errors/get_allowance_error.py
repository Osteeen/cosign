from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

GetAllowanceErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _GetAllowanceError:
    def map(self, status_code: int, content: bytes) -> GetAllowanceErrorBody:
        match status_code:
            case 401 | 500:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


get_allowance_error_mapper: Final[ErrorMapper[GetAllowanceErrorBody]] = _GetAllowanceError()
