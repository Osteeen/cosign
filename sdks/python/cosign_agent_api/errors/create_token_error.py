from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

CreateTokenErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _CreateTokenError:
    def map(self, status_code: int, content: bytes) -> CreateTokenErrorBody:
        match status_code:
            case 401 | 429 | 500:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


create_token_error_mapper: Final[ErrorMapper[CreateTokenErrorBody]] = _CreateTokenError()
