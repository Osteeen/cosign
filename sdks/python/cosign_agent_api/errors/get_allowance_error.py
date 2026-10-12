from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError

GetAllowanceErrorBody: TypeAlias = RawError


@dataclass(frozen=True, slots=True)
class _GetAllowanceError:
    def map(self, status_code: int, content: bytes) -> GetAllowanceErrorBody:
        match status_code:
            case 401 | 500:
                return RawError(status_code, content)
            case _:
                return RawError(status_code, content)


get_allowance_error_mapper: Final[ErrorMapper[GetAllowanceErrorBody]] = _GetAllowanceError()
